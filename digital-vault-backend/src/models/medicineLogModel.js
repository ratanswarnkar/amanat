const pool = require('../config/db');

const getTodayMedicineSchedule = async (userId) => {
  const query = `
    WITH expanded_schedule AS (
      SELECT
        m.id AS medicine_id,
        m.name,
        time_slot.value AS scheduled_time
      FROM medicines m
      CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(m.time_slots, '[]'::jsonb)) AS time_slot(value)
      WHERE m.user_id = $1
        AND (m.start_date IS NULL OR m.start_date <= CURRENT_DATE)
        AND (m.end_date IS NULL OR m.end_date >= CURRENT_DATE)
    ),
    today_logs AS (
      SELECT DISTINCT ON (medicine_id, scheduled_time)
        medicine_id,
        scheduled_time,
        status
      FROM medicine_logs
      WHERE user_id = $1
        AND DATE(created_at) = CURRENT_DATE
      ORDER BY medicine_id, scheduled_time, created_at DESC
    )
    SELECT
      es.medicine_id,
      es.name,
      es.scheduled_time AS time,
      COALESCE(tl.status, 'pending') AS status
    FROM expanded_schedule es
    LEFT JOIN today_logs tl
      ON tl.medicine_id = es.medicine_id
      AND tl.scheduled_time = es.scheduled_time
    ORDER BY es.scheduled_time ASC;
  `;

  const { rows } = await pool.query(query, [userId]);
  return rows;
};

const findMedicineForUser = async ({ medicineId, userId }) => {
  const query = `
    SELECT id
    FROM medicines
    WHERE id = $1 AND user_id = $2
    LIMIT 1;
  `;

  const { rows } = await pool.query(query, [medicineId, userId]);
  return rows[0] || null;
};

const createMedicineLog = async ({
  medicineId,
  userId,
  scheduledTime,
  status,
  takenAt,
}) => {
  const query = `
    INSERT INTO medicine_logs (
      id,
      medicine_id,
      user_id,
      scheduled_time,
      status,
      taken_at
    )
    VALUES (
      gen_random_uuid(),
      $1,
      $2,
      $3,
      $4,
      $5
    )
    RETURNING *;
  `;

  const values = [medicineId, userId, scheduledTime, status, takenAt];
  const { rows } = await pool.query(query, values);
  return rows[0];
};

const updateReminderStatusForSchedule = async ({ medicineId, userId, scheduledTime, status }) => {
  const { rows } = await pool.query(
    `
      UPDATE medicine_reminders
      SET status = $1
      WHERE medicine_id = $2
        AND user_id = $3
        AND reminder_time = $4
        AND DATE(created_at) = CURRENT_DATE
      RETURNING *
    `,
    [status, medicineId, userId, scheduledTime]
  );

  return rows[0] || null;
};

const getAdherenceSummaryByUserId = async (userId) => {
  const { rows } = await pool.query(
    `
      SELECT
        COUNT(*) FILTER (WHERE status IN ('taken', 'missed')) AS total_doses,
        COUNT(*) FILTER (WHERE status = 'taken') AS taken_doses,
        COUNT(*) FILTER (WHERE status = 'missed') AS missed_doses
      FROM medicine_logs
      WHERE user_id = $1
    `,
    [userId]
  );

  const summary = rows[0] || {
    total_doses: 0,
    taken_doses: 0,
    missed_doses: 0,
  };

  const totalDoses = Number(summary.total_doses || 0);
  const takenDoses = Number(summary.taken_doses || 0);
  const missedDoses = Number(summary.missed_doses || 0);

  return {
    total_doses: totalDoses,
    taken_doses: takenDoses,
    missed_doses: missedDoses,
    adherence_percentage: totalDoses > 0 ? Number(((takenDoses / totalDoses) * 100).toFixed(2)) : 0,
  };
};

module.exports = {
  getTodayMedicineSchedule,
  findMedicineForUser,
  createMedicineLog,
  updateReminderStatusForSchedule,
  getAdherenceSummaryByUserId,
};
