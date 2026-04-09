const pool = require('../config/db');

const createPrescription = async ({ userId, doctorName, hospitalName, fileUrl, issueDate, notes }) => {
  const { rows } = await pool.query(
    `
      INSERT INTO prescriptions (user_id, doctor_name, hospital_name, file_url, issue_date, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [userId, doctorName, hospitalName, fileUrl, issueDate || null, notes || null]
  );

  return rows[0];
};

const getPrescriptionsByUserId = async (userId) => {
  const { rows } = await pool.query(
    `
      SELECT *
      FROM prescriptions
      WHERE user_id = $1
      ORDER BY issue_date DESC NULLS LAST, created_at DESC
    `,
    [userId]
  );

  return rows;
};

module.exports = {
  createPrescription,
  getPrescriptionsByUserId,
};
