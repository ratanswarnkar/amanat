const pool = require('../config/db');

const createHealthRecord = async ({ userId, title, recordType, fileUrl, recordDate, notes }) => {
  const { rows } = await pool.query(
    `
      INSERT INTO health_records (user_id, title, record_type, file_url, record_date, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [userId, title, recordType, fileUrl, recordDate || null, notes || null]
  );

  return rows[0];
};

const getHealthRecordsByUserId = async (userId) => {
  const { rows } = await pool.query(
    `
      SELECT *
      FROM health_records
      WHERE user_id = $1
      ORDER BY created_at DESC
    `,
    [userId]
  );

  return rows;
};

const getHealthRecordById = async ({ recordId, userId }) => {
  const { rows } = await pool.query(
    `
      SELECT *
      FROM health_records
      WHERE id = $1 AND user_id = $2
      LIMIT 1
    `,
    [recordId, userId]
  );

  return rows[0] || null;
};

const deleteHealthRecordById = async ({ recordId, userId }) => {
  const { rows } = await pool.query(
    `
      DELETE FROM health_records
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `,
    [recordId, userId]
  );

  return rows[0] || null;
};

module.exports = {
  createHealthRecord,
  getHealthRecordsByUserId,
  getHealthRecordById,
  deleteHealthRecordById,
};
