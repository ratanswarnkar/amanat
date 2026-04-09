const pool = require('../config/db');

const createMedicine = async ({
  userId,
  name,
  dosage,
  timesPerDay,
  timeSlots,
  startDate,
  endDate,
  notes,
}) => {
  const query = `
    INSERT INTO medicines (
      user_id,
      name,
      dosage,
      times_per_day,
      time_slots,
      start_date,
      end_date,
      notes
    )
    VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
    RETURNING *;
  `;

  const values = [
    userId,
    name,
    dosage || null,
    timesPerDay ?? null,
    JSON.stringify(timeSlots || []),
    startDate || null,
    endDate || null,
    notes || null,
  ];

  const { rows } = await pool.query(query, values);
  return rows[0];
};

const getMedicinesByUserId = async (userId) => {
  const query = `
    SELECT *
    FROM medicines
    WHERE user_id = $1
    ORDER BY created_at DESC;
  `;

  const { rows } = await pool.query(query, [userId]);
  return rows;
};

const updateMedicineById = async ({
  medicineId,
  userId,
  name,
  dosage,
  timesPerDay,
  timeSlots,
  startDate,
  endDate,
  notes,
}) => {
  const query = `
    UPDATE medicines
    SET
      name = COALESCE($1, name),
      dosage = COALESCE($2, dosage),
      times_per_day = COALESCE($3, times_per_day),
      time_slots = COALESCE($4::jsonb, time_slots),
      start_date = COALESCE($5, start_date),
      end_date = COALESCE($6, end_date),
      notes = COALESCE($7, notes)
    WHERE id = $8 AND user_id = $9
    RETURNING *;
  `;

  const values = [
    name ?? null,
    dosage ?? null,
    timesPerDay ?? null,
    timeSlots ? JSON.stringify(timeSlots) : null,
    startDate ?? null,
    endDate ?? null,
    notes ?? null,
    medicineId,
    userId,
  ];

  const { rows } = await pool.query(query, values);
  return rows[0] || null;
};

const deleteMedicineById = async ({ medicineId, userId }) => {
  const query = `
    DELETE FROM medicines
    WHERE id = $1 AND user_id = $2
    RETURNING id;
  `;

  const { rows } = await pool.query(query, [medicineId, userId]);
  return rows[0] || null;
};

module.exports = {
  createMedicine,
  getMedicinesByUserId,
  updateMedicineById,
  deleteMedicineById,
};
