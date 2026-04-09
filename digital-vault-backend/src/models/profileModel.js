const pool = require('../config/db');

const normalizeProfile = (row) => {
  if (!row) {
    return null;
  }

  const normalizedName = String(row.name || '').trim();

  return {
    user_id: row.user_id,
    name: normalizedName,
    email: row.email || '',
    phone: row.phone || '',
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
};

const findProfileByUserId = async (userId) => {
  const query = `
    SELECT *
    FROM (
      SELECT
        u.id AS user_id,
        CASE
          WHEN COALESCE(NULLIF(BTRIM(up.full_name), ''), NULLIF(BTRIM(u.full_name), ''), '') = 'User' THEN ''
          ELSE COALESCE(NULLIF(BTRIM(up.full_name), ''), NULLIF(BTRIM(u.full_name), ''), '')
        END AS name,
        COALESCE(NULLIF(BTRIM(u.email), ''), '') AS email,
        COALESCE(NULLIF(BTRIM(u.mobile), ''), '') AS phone,
        COALESCE(up.created_at, u.created_at) AS created_at,
        GREATEST(COALESCE(up.updated_at, u.updated_at), COALESCE(u.updated_at, up.updated_at)) AS updated_at
      FROM users u
      LEFT JOIN user_profiles up
        ON up.user_id = u.id
      WHERE u.id = $1
    ) profile
    LIMIT 1
  `;

  const { rows } = await pool.query(query, [userId]);
  return normalizeProfile(rows[0] || null);
};

const updateProfileByUserId = async ({ userId, name, email }) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `
        UPDATE users
        SET full_name = $2,
            email = $3,
            updated_at = NOW()
        WHERE id = $1
      `,
      [userId, name, email || null]
    );

    await client.query(
      `
        INSERT INTO user_profiles (
          id,
          user_id,
          full_name
        )
        VALUES (gen_random_uuid(), $1, $2)
        ON CONFLICT (user_id)
        DO UPDATE SET
          full_name = EXCLUDED.full_name,
          updated_at = NOW()
      `,
      [userId, name]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null);
    throw error;
  } finally {
    client.release();
  }

  return findProfileByUserId(userId);
};

module.exports = {
  findProfileByUserId,
  updateProfileByUserId,
};
