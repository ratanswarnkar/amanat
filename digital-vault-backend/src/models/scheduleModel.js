const pool = require('../config/db');

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

const normalizeTime = (value) => {
  const raw = String(value || '').trim();
  const match = raw.match(TIME_REGEX);
  if (!match) {
    return null;
  }

  const hh = match[1];
  const mm = match[2];
  const ss = match[3] || '00';
  return `${hh}:${mm}:${ss}`;
};

const normalizeTimes = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique = new Set();
  for (const item of value) {
    const normalized = normalizeTime(item);
    if (normalized) {
      unique.add(normalized);
    }
  }

  return Array.from(unique);
};

const ensureMedicineForSchedule = async ({
  client,
  patientId,
  medicineName,
  dosage,
  scheduleTimes,
  medicineId = null,
}) => {
  if (medicineId) {
    const existing = await client.query(
      `
        SELECT id
        FROM medicines
        WHERE id = $1::uuid
          AND user_id = $2::uuid
        LIMIT 1
      `,
      [medicineId, patientId]
    );

    if (existing.rows[0]) {
      await client.query(
        `
          UPDATE medicines
          SET
            name = $1::text,
            dosage = $2::text,
            times_per_day = $3::integer,
            time_slots = $4::jsonb,
            updated_at = NOW()
          WHERE id = $5::uuid
            AND user_id = $6::uuid
        `,
        [medicineName, dosage || null, scheduleTimes.length || null, JSON.stringify(scheduleTimes), medicineId, patientId]
      );
      return medicineId;
    }
  }

  const byName = await client.query(
    `
      SELECT id
      FROM medicines
      WHERE user_id = $1::uuid
        AND LOWER(name) = LOWER($2::text)
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [patientId, medicineName]
  );

  if (byName.rows[0]) {
    const linkedMedicineId = byName.rows[0].id;
    await client.query(
      `
        UPDATE medicines
        SET
          dosage = COALESCE($1::text, dosage),
          times_per_day = $2::integer,
          time_slots = $3::jsonb,
          updated_at = NOW()
        WHERE id = $4::uuid
      `,
      [dosage || null, scheduleTimes.length || null, JSON.stringify(scheduleTimes), linkedMedicineId]
    );
    return linkedMedicineId;
  }

  const created = await client.query(
    `
      INSERT INTO medicines (user_id, name, dosage, times_per_day, time_slots)
      VALUES ($1::uuid, $2::text, $3::text, $4::integer, $5::jsonb)
      RETURNING id
    `,
    [patientId, medicineName, dosage || null, scheduleTimes.length || null, JSON.stringify(scheduleTimes)]
  );

  return created.rows[0].id;
};

const refreshPendingRemindersForSchedule = async ({
  client,
  scheduleId,
  medicineId,
  patientId,
  createdBy,
  scheduleTimes,
}) => {
  await client.query(
    `
      DELETE FROM medicine_reminders
      WHERE schedule_id = $1::uuid
        AND status = 'pending'
    `,
    [scheduleId]
  );

  if (!scheduleTimes.length) {
    return;
  }

  for (const time of scheduleTimes) {
    await client.query(
      `
        INSERT INTO medicine_reminders (
          medicine_id,
          user_id,
          reminder_time,
          status,
          schedule_id,
          created_by
        )
        VALUES ($1::uuid, $2::uuid, $3::text, 'pending', $4::uuid, $5::uuid)
      `,
      [medicineId, patientId, time, scheduleId, createdBy]
    );
  }
};

const toScheduleRecord = (row) => ({
  id: row.id,
  patient_id: row.patient_id,
  medicine_id: row.medicine_id,
  medicine_name: row.medicine_name,
  dosage: row.dosage,
  time: Array.isArray(row.schedule_times) ? row.schedule_times : [],
  repeat_type: row.repeat_type,
  custom_pattern: Array.isArray(row.custom_pattern) ? row.custom_pattern : [],
  created_by: row.created_by,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const createSchedule = async ({
  patientId,
  medicineName,
  dosage,
  times,
  repeatType,
  customPattern,
  createdBy,
}) => {
  const scheduleTimes = normalizeTimes(times);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const medicineId = await ensureMedicineForSchedule({
      client,
      patientId,
      medicineName,
      dosage,
      scheduleTimes,
    });

    const inserted = await client.query(
      `
        INSERT INTO medicine_schedules (
          patient_id,
          medicine_id,
          medicine_name,
          dosage,
          schedule_times,
          repeat_type,
          custom_pattern,
          created_by
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          $3::text,
          $4::text,
          $5::jsonb,
          $6::text,
          $7::jsonb,
          $8::uuid
        )
        RETURNING *
      `,
      [
        patientId,
        medicineId,
        medicineName,
        dosage || null,
        JSON.stringify(scheduleTimes),
        repeatType,
        JSON.stringify(Array.isArray(customPattern) ? customPattern : []),
        createdBy,
      ]
    );

    const schedule = inserted.rows[0];

    await refreshPendingRemindersForSchedule({
      client,
      scheduleId: schedule.id,
      medicineId,
      patientId,
      createdBy,
      scheduleTimes,
    });

    await client.query('COMMIT');
    return toScheduleRecord(schedule);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const listSchedulesByPatientId = async (patientId) => {
  const { rows } = await pool.query(
    `
      SELECT *
      FROM medicine_schedules
      WHERE patient_id = $1::uuid
        AND is_active = TRUE
      ORDER BY created_at DESC
    `,
    [patientId]
  );

  return rows.map(toScheduleRecord);
};

const updateScheduleById = async ({
  scheduleId,
  patientId,
  medicineName,
  dosage,
  times,
  repeatType,
  customPattern,
  updatedBy,
}) => {
  const scheduleTimes = normalizeTimes(times);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existingResult = await client.query(
      `
        SELECT *
        FROM medicine_schedules
        WHERE id = $1::uuid
          AND patient_id = $2::uuid
          AND is_active = TRUE
        LIMIT 1
      `,
      [scheduleId, patientId]
    );

    const existing = existingResult.rows[0];
    if (!existing) {
      await client.query('ROLLBACK');
      return null;
    }

    const resolvedName = medicineName || existing.medicine_name;
    const resolvedDosage = dosage !== undefined ? dosage : existing.dosage;
    const resolvedTimes = scheduleTimes.length
      ? scheduleTimes
      : normalizeTimes(existing.schedule_times || []);
    const resolvedRepeatType = repeatType || existing.repeat_type;
    const resolvedCustomPattern = Array.isArray(customPattern)
      ? customPattern
      : (Array.isArray(existing.custom_pattern) ? existing.custom_pattern : []);

    const linkedMedicineId = await ensureMedicineForSchedule({
      client,
      patientId,
      medicineName: resolvedName,
      dosage: resolvedDosage,
      scheduleTimes: resolvedTimes,
      medicineId: existing.medicine_id || null,
    });

    const updated = await client.query(
      `
        UPDATE medicine_schedules
        SET
          medicine_id = $1::uuid,
          medicine_name = $2::text,
          dosage = $3::text,
          schedule_times = $4::jsonb,
          repeat_type = $5::text,
          custom_pattern = $6::jsonb,
          created_by = $7::uuid,
          updated_at = NOW()
        WHERE id = $8::uuid
          AND patient_id = $9::uuid
          AND is_active = TRUE
        RETURNING *
      `,
      [
        linkedMedicineId,
        resolvedName,
        resolvedDosage || null,
        JSON.stringify(resolvedTimes),
        resolvedRepeatType,
        JSON.stringify(resolvedCustomPattern),
        updatedBy,
        scheduleId,
        patientId,
      ]
    );

    const schedule = updated.rows[0];
    await refreshPendingRemindersForSchedule({
      client,
      scheduleId: schedule.id,
      medicineId: linkedMedicineId,
      patientId,
      createdBy: updatedBy,
      scheduleTimes: resolvedTimes,
    });

    await client.query('COMMIT');
    return toScheduleRecord(schedule);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const deleteScheduleById = async ({ scheduleId, patientId }) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `
        SELECT id
        FROM medicine_schedules
        WHERE id = $1::uuid
          AND patient_id = $2::uuid
          AND is_active = TRUE
        LIMIT 1
      `,
      [scheduleId, patientId]
    );

    if (!existing.rows[0]) {
      await client.query('ROLLBACK');
      return false;
    }

    await client.query(
      `
        DELETE FROM medicine_reminders
        WHERE schedule_id = $1::uuid
          AND status = 'pending'
      `,
      [scheduleId]
    );

    await client.query(
      `
        UPDATE medicine_schedules
        SET is_active = FALSE,
            updated_at = NOW()
        WHERE id = $1::uuid
          AND patient_id = $2::uuid
      `,
      [scheduleId, patientId]
    );

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  createSchedule,
  listSchedulesByPatientId,
  updateScheduleById,
  deleteScheduleById,
  normalizeTimes,
};
