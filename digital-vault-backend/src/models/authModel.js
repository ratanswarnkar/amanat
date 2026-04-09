const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const pool = require('../config/db');

let otpSchemaCache = null;

const loadOtpSchema = async () => {
  if (otpSchemaCache) {
    return otpSchemaCache;
  }

  const { rows } = await pool.query(
    `
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'otp_codes'
    `
  );

  const columnMap = new Map(rows.map((row) => [row.column_name, row]));
  otpSchemaCache = {
    hasPhone: columnMap.has('phone'),
    hasMobile: columnMap.has('mobile'),
    hasVerified: columnMap.has('verified'),
    hasAttempts: columnMap.has('attempts'),
    idType: columnMap.get('id')?.data_type || null,
    idDefault: columnMap.get('id')?.column_default || null,
  };

  return otpSchemaCache;
};

const getPhoneMatchCondition = (schema, paramIndex = 1) => {
  if (schema.hasPhone && schema.hasMobile) {
    return `(phone = $${paramIndex} OR mobile = $${paramIndex})`;
  }

  if (schema.hasPhone) {
    return `phone = $${paramIndex}`;
  }

  return `mobile = $${paramIndex}`;
};

const createOtpCode = async ({ phone, otp, expiresAt }) => {
  const schema = await loadOtpSchema();
  const columns = [];
  const placeholders = [];
  const values = [];
  let index = 1;

  if (schema.idType === 'uuid' && !schema.idDefault) {
    columns.push('id');
    placeholders.push(`$${index++}`);
    values.push(uuidv4());
  }

  if (schema.hasPhone) {
    columns.push('phone');
    placeholders.push(`$${index++}`);
    values.push(phone);
  }

  if (schema.hasMobile) {
    columns.push('mobile');
    placeholders.push(`$${index++}`);
    values.push(phone);
  }

  columns.push('otp');
  placeholders.push(`$${index++}`);
  values.push(otp);

  columns.push('expires_at');
  placeholders.push(`$${index++}`);
  values.push(expiresAt);

  if (schema.hasVerified) {
    columns.push('verified');
    placeholders.push(`$${index++}`);
    values.push(false);
  }

  if (schema.hasAttempts) {
    columns.push('attempts');
    placeholders.push(`$${index++}`);
    values.push(0);
  }

  const query = `
    INSERT INTO otp_codes (${columns.join(', ')})
    VALUES (${placeholders.join(', ')})
    RETURNING *
  `;

  const { rows } = await pool.query(query, values);
  return rows[0];
};

const findValidOtpCode = async ({ phone, otp }) => {
  const schema = await loadOtpSchema();
  const phoneCondition = getPhoneMatchCondition(schema, 1);
  const verifiedCondition = schema.hasVerified ? 'AND verified = false' : '';
  const query = `
    SELECT *
    FROM otp_codes
    WHERE ${phoneCondition}
      AND otp = $2
      ${verifiedCondition}
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1
  `;

  const { rows } = await pool.query(query, [phone, otp]);
  return rows[0] || null;
};

const findLatestOtpCodeByPhone = async (phone) => {
  const schema = await loadOtpSchema();
  const phoneCondition = getPhoneMatchCondition(schema, 1);
  const verifiedCondition = schema.hasVerified ? 'AND verified = false' : '';
  const query = `
    SELECT *
    FROM otp_codes
    WHERE ${phoneCondition}
      ${verifiedCondition}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  const { rows } = await pool.query(query, [phone]);
  return rows[0] || null;
};

const incrementOtpAttempts = async (id) => {
  const schema = await loadOtpSchema();

  if (!schema.hasAttempts) {
    return;
  }

  await pool.query(
    `
      UPDATE otp_codes
      SET attempts = attempts + 1
      WHERE id = $1
    `,
    [id]
  );
};

const deleteOtpCodesByPhone = async (phone) => {
  const schema = await loadOtpSchema();
  const phoneCondition = getPhoneMatchCondition(schema, 1);

  if (schema.hasVerified) {
    await pool.query(
      `
        UPDATE otp_codes
        SET verified = true
        WHERE ${phoneCondition}
      `,
      [phone]
    );
    return;
  }

  await pool.query(
    `
      DELETE FROM otp_codes
      WHERE ${phoneCondition}
    `,
    [phone]
  );
};

const deleteExpiredOtpCodes = async () => {
  await pool.query(
    `
      DELETE FROM otp_codes
      WHERE expires_at <= NOW()
    `
  );
};

const findUserByMobile = async (mobile) => {
  const query = 'SELECT * FROM users WHERE mobile = $1 LIMIT 1';
  const { rows } = await pool.query(query, [mobile]);
  return rows[0] || null;
};

const findUserByEmail = async (email) => {
  const query = 'SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1';
  const { rows } = await pool.query(query, [email]);
  return rows[0] || null;
};

const findUserById = async (id) => {
  const query = 'SELECT * FROM users WHERE id = $1 LIMIT 1';
  const { rows } = await pool.query(query, [id]);
  return rows[0] || null;
};

const getUserRoles = async (userId) => {
  const [nomineeResult, caretakerResult] = await Promise.all([
    pool.query(
      `
        SELECT 1
        FROM nominees
        WHERE nominee_user_id = $1::uuid
          AND status = 'approved'
        LIMIT 1
      `,
      [userId]
    ),
    pool.query(
      `
        SELECT 1
        FROM caretakers
        WHERE caretaker_user_id = $1::uuid
          AND status = 'approved'
        LIMIT 1
      `,
      [userId]
    ),
  ]);

  return {
    owner: true,
    nominee: nomineeResult.rows.length > 0,
    caretaker: caretakerResult.rows.length > 0,
  };
};

const findAdminByIdentifier = async (identifier) => {
  const value = String(identifier || '').trim();
  if (!value) {
    return null;
  }

  const { rows } = await pool.query(
    `
      SELECT *
      FROM users
      WHERE role = 'admin'
        AND (
          LOWER(email) = LOWER($1)
          OR mobile = $1
        )
      LIMIT 1
    `,
    [value]
  );

  return rows[0] || null;
};

const createUserWithRoleMobile = async ({ id, mobile, role = 'user' }) => {
  const query = `
    INSERT INTO users (id, full_name, mobile, role, is_mobile_verified)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;

  const { rows } = await pool.query(query, [id, role === 'nominee' ? 'Nominee' : 'User', mobile, role, true]);
  return rows[0];
};

const createUserWithMobile = async ({ id, mobile }) => createUserWithRoleMobile({ id, mobile, role: 'user' });

const setUserMobileVerified = async (mobile) => {
  const query = `
    UPDATE users
    SET is_mobile_verified = true
    WHERE mobile = $1
  `;

  await pool.query(query, [mobile]);
};

const updateUserPinHash = async ({ mobile, pinHash }) => {
  const query = `
    UPDATE users
    SET pin_hash = $1
    WHERE mobile = $2
    RETURNING *
  `;

  const { rows } = await pool.query(query, [pinHash, mobile]);
  return rows[0] || null;
};

const updateUserBlockedState = async ({ userId, isBlocked }) => {
  const { rows } = await pool.query(
    `
      UPDATE users
      SET is_blocked = $2::boolean,
          updated_at = NOW()
      WHERE id = $1::uuid
      RETURNING id, full_name, mobile, email, role, is_mobile_verified, is_active, is_blocked, created_at, updated_at
    `,
    [userId, Boolean(isBlocked)]
  );

  return rows[0] || null;
};

const listUsersPaginated = async ({ page = 1, limit = 20 }) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const offset = (safePage - 1) * safeLimit;

  const countResult = await pool.query(
    `
      SELECT COUNT(*)::int AS total
      FROM users
    `
  );

  const { rows } = await pool.query(
    `
      SELECT id, full_name, mobile, email, role, is_mobile_verified, is_active, is_blocked, created_at, updated_at
      FROM users
      ORDER BY created_at DESC
      LIMIT $1::int
      OFFSET $2::int
    `,
    [safeLimit, offset]
  );

  return {
    users: rows,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: Number(countResult.rows[0]?.total || 0),
    },
  };
};

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const createSession = async ({ userId, refreshToken, userAgent, ipAddress, expiresAt }) => {
  const refreshTokenHash = hashToken(refreshToken);
  const { rows } = await pool.query(
    `
      INSERT INTO auth_sessions (user_id, refresh_token_hash, user_agent, ip_address, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    [userId, refreshTokenHash, userAgent || null, ipAddress || null, expiresAt]
  );

  return rows[0];
};

const findActiveSessionById = async (sessionId) => {
  const { rows } = await pool.query(
    `
      SELECT *
      FROM auth_sessions
      WHERE id = $1
        AND revoked_at IS NULL
        AND expires_at > NOW()
      LIMIT 1
    `,
    [sessionId]
  );

  return rows[0] || null;
};

const findActiveSessionByRefreshToken = async (refreshToken) => {
  const refreshTokenHash = hashToken(refreshToken);
  const { rows } = await pool.query(
    `
      SELECT *
      FROM auth_sessions
      WHERE refresh_token_hash = $1
        AND revoked_at IS NULL
        AND expires_at > NOW()
      LIMIT 1
    `,
    [refreshTokenHash]
  );

  return rows[0] || null;
};

const rotateSessionRefreshToken = async ({ sessionId, refreshToken, expiresAt }) => {
  const refreshTokenHash = hashToken(refreshToken);
  const { rows } = await pool.query(
    `
      UPDATE auth_sessions
      SET refresh_token_hash = $1,
          expires_at = $2,
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `,
    [refreshTokenHash, expiresAt, sessionId]
  );

  return rows[0] || null;
};

const revokeSessionById = async (sessionId) => {
  await pool.query(
    `
      UPDATE auth_sessions
      SET revoked_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
        AND revoked_at IS NULL
    `,
    [sessionId]
  );
};

const revokeAllSessionsForUser = async (userId) => {
  await pool.query(
    `
      UPDATE auth_sessions
      SET revoked_at = NOW(),
          updated_at = NOW()
      WHERE user_id = $1
        AND revoked_at IS NULL
    `,
    [userId]
  );
};

module.exports = {
  createOtpCode,
  findValidOtpCode,
  findLatestOtpCodeByPhone,
  incrementOtpAttempts,
  deleteOtpCodesByPhone,
  deleteExpiredOtpCodes,
  findUserByMobile,
  findUserByEmail,
  findUserById,
  getUserRoles,
  findAdminByIdentifier,
  createUserWithRoleMobile,
  createUserWithMobile,
  setUserMobileVerified,
  updateUserPinHash,
  updateUserBlockedState,
  listUsersPaginated,
  createSession,
  findActiveSessionById,
  findActiveSessionByRefreshToken,
  rotateSessionRefreshToken,
  revokeSessionById,
  revokeAllSessionsForUser,
};
