const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const pool = require('../config/db');
const { isBlockedDefaultAdminIdentifier } = require('./insecureAdminRemediationService');

const MIN_PASSWORD_LENGTH = 12;
const BCRYPT_ROUNDS = 12;
const COMMON_WEAK_PASSWORDS = new Set([
  'admin',
  'admin123',
  'admin@123',
  'password',
  'password123',
  'qwerty123',
  'letmein123',
  '12345678',
  '123456789',
  '1234567890',
]);

const normalizeEmail = (email = '') => String(email || '').trim().toLowerCase();

const isValidEmail = (email = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const validateAdminPassword = ({ password, email }) => {
  const value = String(password || '');
  const normalizedPassword = value.trim().toLowerCase();
  const normalizedEmail = normalizeEmail(email);
  const emailLocalPart = normalizedEmail.split('@')[0];

  if (value.length < MIN_PASSWORD_LENGTH) {
    return 'Password must be at least 12 characters long';
  }

  if (!/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/\d/.test(value) || !/[^A-Za-z0-9]/.test(value)) {
    return 'Password must include uppercase, lowercase, number, and special character';
  }

  if (COMMON_WEAK_PASSWORDS.has(normalizedPassword)) {
    return 'Weak passwords are not allowed';
  }

  if (emailLocalPart && normalizedPassword.includes(emailLocalPart)) {
    return 'Password must not contain the email name';
  }

  return null;
};

const assertBootstrapAccess = ({ secret } = {}) => {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const configuredSecret = String(process.env.ADMIN_BOOTSTRAP_SECRET || '').trim();
  const providedSecret = String(secret || '').trim();

  if (!configuredSecret || providedSecret !== configuredSecret) {
    const error = new Error('Admin bootstrap is disabled');
    error.statusCode = 403;
    throw error;
  }
};

const getExistingAdmin = async (queryable = pool) => {
  const { rows } = await queryable.query(
    `
      SELECT id, email, mobile, role, created_at
      FROM users
      WHERE role = 'admin'
      ORDER BY created_at ASC
      LIMIT 1
    `
  );

  return rows[0] || null;
};

const assertAdminEmailAllowed = ({ email, allowBlockedDefaultIdentifier = false }) => {
  const normalizedEmail = normalizeEmail(email);

  if (isBlockedDefaultAdminIdentifier(normalizedEmail) && !allowBlockedDefaultIdentifier) {
    const error = new Error('Default admin identifiers are blocked');
    error.statusCode = 400;
    throw error;
  }
};

const generateUniqueAdminMobile = async (queryable) => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = `9${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`;
    const { rows } = await queryable.query(
      `
        SELECT 1
        FROM users
        WHERE mobile = $1
        LIMIT 1
      `,
      [candidate]
    );

    if (rows.length === 0) {
      return candidate;
    }
  }

  const error = new Error('Failed to generate a unique admin mobile');
  error.statusCode = 500;
  throw error;
};

const createAdminUser = async ({ email, password, secret } = {}) => {
  assertBootstrapAccess({ secret });

  const normalizedEmail = normalizeEmail(email);
  if (!isValidEmail(normalizedEmail)) {
    const error = new Error('Valid email is required');
    error.statusCode = 400;
    throw error;
  }

  assertAdminEmailAllowed({ email: normalizedEmail });

  const passwordError = validateAdminPassword({ password, email: normalizedEmail });
  if (passwordError) {
    const error = new Error(passwordError);
    error.statusCode = 400;
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [1700170017]);

    const existingAdmin = await getExistingAdmin(client);
    if (existingAdmin) {
      const error = new Error('Admin user already exists');
      error.statusCode = 409;
      error.details = {
        adminId: existingAdmin.id,
        email: existingAdmin.email || null,
        createdAt: existingAdmin.created_at,
      };
      throw error;
    }

    const existingByEmail = await client.query(
      `
        SELECT id
        FROM users
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1
      `,
      [normalizedEmail]
    );

    if (existingByEmail.rows.length > 0) {
      const error = new Error('Email is already in use');
      error.statusCode = 409;
      throw error;
    }

    const passwordHash = await bcrypt.hash(String(password), BCRYPT_ROUNDS);
    const mobile = await generateUniqueAdminMobile(client);

    const { rows } = await client.query(
      `
        INSERT INTO users (
          id,
          full_name,
          mobile,
          email,
          role,
          pin_hash,
          is_mobile_verified,
          is_blocked
        )
        VALUES ($1, $2, $3, $4, 'admin', $5, TRUE, FALSE)
        RETURNING id, email, mobile, role, created_at
      `,
      [uuidv4(), 'Amanat Admin', mobile, normalizedEmail, passwordHash]
    );

    await client.query('COMMIT');
    return rows[0];
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null);
    throw error;
  } finally {
    client.release();
  }
};

const resetOrCreateAdminUser = async ({
  email,
  password,
  secret,
  allowBlockedDefaultIdentifier = process.env.NODE_ENV !== 'production',
} = {}) => {
  assertBootstrapAccess({ secret });

  const normalizedEmail = normalizeEmail(email);
  if (!isValidEmail(normalizedEmail)) {
    const error = new Error('Valid email is required');
    error.statusCode = 400;
    throw error;
  }

  assertAdminEmailAllowed({
    email: normalizedEmail,
    allowBlockedDefaultIdentifier,
  });

  const passwordError = validateAdminPassword({ password, email: normalizedEmail });
  if (passwordError) {
    const error = new Error(passwordError);
    error.statusCode = 400;
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [1700170017]);

    const passwordHash = await bcrypt.hash(String(password), BCRYPT_ROUNDS);
    const existingAdmin = await getExistingAdmin(client);

    if (existingAdmin) {
      const existingAdminEmail = normalizeEmail(existingAdmin.email);

      if (normalizedEmail !== existingAdminEmail) {
        const existingByEmail = await client.query(
          `
            SELECT id
            FROM users
            WHERE LOWER(email) = LOWER($1)
              AND id <> $2
            LIMIT 1
          `,
          [normalizedEmail, existingAdmin.id]
        );

        if (existingByEmail.rows.length > 0) {
          const error = new Error('Email is already in use');
          error.statusCode = 409;
          throw error;
        }
      }

      const { rows } = await client.query(
        `
          UPDATE users
          SET pin_hash = $1,
              email = $2,
              is_blocked = FALSE,
              updated_at = NOW()
          WHERE id = $3
          RETURNING id, email, mobile, role, created_at, updated_at
        `,
        [passwordHash, normalizedEmail, existingAdmin.id]
      );

      await client.query(
        `
          DELETE FROM auth_sessions
          WHERE user_id = $1
        `,
        [existingAdmin.id]
      );

      await client.query('COMMIT');
      return {
        action: 'reset',
        admin: rows[0],
      };
    }

    const existingByEmail = await client.query(
      `
        SELECT id
        FROM users
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1
      `,
      [normalizedEmail]
    );

    if (existingByEmail.rows.length > 0) {
      const error = new Error('Email is already in use');
      error.statusCode = 409;
      throw error;
    }

    const mobile = await generateUniqueAdminMobile(client);
    const { rows } = await client.query(
      `
        INSERT INTO users (
          id,
          full_name,
          mobile,
          email,
          role,
          pin_hash,
          is_mobile_verified,
          is_blocked
        )
        VALUES ($1, $2, $3, $4, 'admin', $5, TRUE, FALSE)
        RETURNING id, email, mobile, role, created_at, updated_at
      `,
      [uuidv4(), 'Amanat Admin', mobile, normalizedEmail, passwordHash]
    );

    await client.query('COMMIT');
    return {
      action: 'created',
      admin: rows[0],
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  assertBootstrapAccess,
  createAdminUser,
  getExistingAdmin,
  normalizeEmail,
  resetOrCreateAdminUser,
  validateAdminPassword,
};
