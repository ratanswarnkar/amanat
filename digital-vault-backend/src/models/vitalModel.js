const pool = require('../config/db');

const createVital = async ({ userId, type, value, unit, recordedAt }) => {
  const { rows } = await pool.query(
    `
      INSERT INTO vitals (user_id, type, value, unit, recorded_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    [userId, type, value, unit || null, recordedAt || new Date()]
  );

  return rows[0];
};

const getVitalsByUserId = async (userId) => {
  const { rows } = await pool.query(
    `
      SELECT *
      FROM vitals
      WHERE user_id = $1
      ORDER BY recorded_at DESC
    `,
    [userId]
  );

  return rows;
};

module.exports = {
  createVital,
  getVitalsByUserId,
};
