const pool = require('../config/db');
const logger = require('../utils/logger');

const DEFAULT_ADMIN_EMAIL = 'admin@amanat.com';
const DEFAULT_ADMIN_MOBILE = '9000000000';

const removeInsecureDefaultAdminAccount = async () => {
  if (process.env.NODE_ENV === 'development') {
    return { removed: 0 };
  }

  const { rows } = await pool.query(
    `
      SELECT id
      FROM users
      WHERE role = 'admin'
        AND LOWER(email) = LOWER($1)
        AND mobile = $2
    `,
    [DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_MOBILE]
  );

  if (rows.length === 0) {
    return { removed: 0 };
  }

  const userIds = rows.map((row) => row.id);

  await pool.query(
    `
      DELETE FROM auth_sessions
      WHERE user_id = ANY($1::uuid[])
    `,
    [userIds]
  );

  const deleted = await pool.query(
    `
      DELETE FROM users
      WHERE id = ANY($1::uuid[])
    `,
    [userIds]
  );

  if (deleted.rowCount > 0) {
    logger.warn('⚠️ Removed insecure default admin account', {
      removedCount: deleted.rowCount,
      email: DEFAULT_ADMIN_EMAIL,
    });
  }

  return { removed: deleted.rowCount };
};

const isBlockedDefaultAdminIdentifier = (identifier) => {
  if (process.env.NODE_ENV === 'development') {
    return false;
  }

  const normalized = String(identifier || '').trim().toLowerCase();
  return normalized === DEFAULT_ADMIN_EMAIL || normalized === DEFAULT_ADMIN_MOBILE;
};

module.exports = {
  removeInsecureDefaultAdminAccount,
  isBlockedDefaultAdminIdentifier,
};
