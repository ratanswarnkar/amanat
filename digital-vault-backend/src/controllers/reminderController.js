const pool = require('../config/db');
const { isExpoPushToken } = require('../services/notificationService');

const sanitizeEmpty = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
};

const normalizeReminderTime = (value) => {
  const raw = sanitizeEmpty(value);

  if (!raw) {
    return null;
  }

  const match = raw.match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
  if (!match) {
    return null;
  }

  const hours = match[1];
  const minutes = match[2];
  const seconds = match[3] || '00';

  return `${hours}:${minutes}:${seconds}`;
};

const normalizeTimezone = (value) => {
  const timezone = sanitizeEmpty(value);
  if (!timezone) {
    return 'Asia/Kolkata';
  }

  try {
    Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return timezone;
  } catch (_error) {
    return 'Asia/Kolkata';
  }
};

const getUserId = (req) => req.user?.userId || req.user?.sub;
const getPatientId = (req) => req.accessContext?.patientId || getUserId(req);

const getReminders = async (req, res) => {
  try {
    const userId = getPatientId(req);

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { rows } = await pool.query(
      `
        SELECT
          r.id,
          r.medicine_id,
          m.name,
          r.reminder_time,
          r.status,
          r.created_at
        FROM medicine_reminders r
        JOIN medicines m ON r.medicine_id = m.id
        WHERE r.user_id = $1
          AND r.status = 'pending'
        ORDER BY r.created_at DESC
      `,
      [userId]
    );

    return res.status(200).json(rows);
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch reminders',
      error: error.message,
    });
  }
};

const createReminder = async (req, res) => {
  try {
    console.log('[Reminder Create] req.body', req.body);

    const userId = getPatientId(req);
    const medicineIdFromPayload = sanitizeEmpty(req.body?.medicine_id);
    const medicineName = sanitizeEmpty(req.body?.medicineName);
    const reminderTime = normalizeReminderTime(req.body?.reminder_time || req.body?.time);

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!reminderTime) {
      return res.status(400).json({ message: 'time must be in HH:MM or HH:MM:SS format' });
    }

    if (!medicineIdFromPayload && !medicineName) {
      return res.status(400).json({ message: 'medicineName or medicine_id is required' });
    }

    let medicineCheck;
    if (medicineIdFromPayload) {
      medicineCheck = await pool.query(
        `
          SELECT id, name
          FROM medicines
          WHERE id = $1
            AND user_id = $2
          LIMIT 1
        `,
        [medicineIdFromPayload, userId]
      );
    } else {
      medicineCheck = await pool.query(
        `
          SELECT id, name
          FROM medicines
          WHERE user_id = $1
            AND LOWER(name) = LOWER($2)
          ORDER BY created_at DESC
          LIMIT 1
        `,
        [userId, medicineName]
      );
    }

    if (!medicineCheck.rows[0]) {
      return res.status(404).json({ message: 'Medicine not found for this user' });
    }

    const medicineId = medicineCheck.rows[0].id;

    const insertResult = await pool.query(
      `
        INSERT INTO medicine_reminders (medicine_id, user_id, reminder_time, status)
        SELECT $1::uuid, $2::uuid, $3::text, 'pending'
        WHERE NOT EXISTS (
          SELECT 1
          FROM medicine_reminders
          WHERE medicine_id = $1::uuid
            AND user_id = $2::uuid
            AND reminder_time::text = $3::text
            AND DATE(created_at) = CURRENT_DATE
            AND status = 'pending'
        )
        RETURNING id, medicine_id, user_id, reminder_time, status, created_at
      `,
      [medicineId, userId, reminderTime]
    );

    if (!insertResult.rows[0]) {
      return res.status(409).json({ message: 'Reminder already exists for this medicine and time today' });
    }

    return res.status(201).json({
      message: 'Reminder created successfully',
      reminder: {
        ...insertResult.rows[0],
        name: medicineCheck.rows[0].name,
      },
    });
  } catch (error) {
    console.log('[Reminder Create Error]', error);
    return res.status(500).json({
      message: 'Failed to create reminder',
      error: error.message,
    });
  }
};

const completeReminder = async (req, res) => {
  try {
    const userId = getPatientId(req);
    const reminderId = String(req.params?.id || '').trim();

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!reminderId) {
      return res.status(400).json({ message: 'Reminder id is required' });
    }

    const { rows } = await pool.query(
      `
        UPDATE medicine_reminders
        SET status = 'completed'
        WHERE id = $1::uuid
          AND user_id = $2::uuid
        RETURNING id, medicine_id, user_id, reminder_time, status, created_at
      `,
      [reminderId, userId]
    );

    if (!rows[0]) {
      return res.status(404).json({ message: 'Reminder not found' });
    }

    return res.status(200).json({
      message: 'Reminder marked as completed',
      reminder: rows[0],
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to complete reminder',
      error: error.message,
    });
  }
};

const registerDeviceToken = async (req, res) => {
  try {
    const userId = getPatientId(req);

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const token = sanitizeEmpty(req.body?.token);
    const platform = sanitizeEmpty(req.body?.platform) || 'unknown';
    const appId = sanitizeEmpty(req.body?.app_id) || 'amanat-app';
    const timezone = normalizeTimezone(req.body?.timezone);
    const isActive = req.body?.is_active !== false;

    if (!token) {
      return res.status(400).json({ message: 'token is required' });
    }

    if (!isExpoPushToken(token)) {
      return res.status(400).json({ message: 'Invalid Expo push token format' });
    }

    const { rows } = await pool.query(
      `
        INSERT INTO user_device_tokens (user_id, token, platform, app_id, timezone, is_active, last_seen_at, updated_at)
        VALUES ($1::uuid, $2::text, $3::text, $4::text, $5::text, $6::boolean, NOW(), NOW())
        ON CONFLICT (token)
        DO UPDATE SET
          user_id = EXCLUDED.user_id,
          platform = EXCLUDED.platform,
          app_id = EXCLUDED.app_id,
          timezone = EXCLUDED.timezone,
          is_active = EXCLUDED.is_active,
          last_seen_at = NOW(),
          updated_at = NOW()
        RETURNING id, user_id, token, platform, app_id, timezone, is_active, updated_at
      `,
      [userId, token, platform, appId, timezone, isActive]
    );

    return res.status(200).json({
      message: 'Device token registered',
      token: rows[0],
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to register device token',
      error: error.message,
    });
  }
};

const getNotificationHistory = async (req, res) => {
  try {
    const userId = getPatientId(req);

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { rows } = await pool.query(
      `
        SELECT
          rn.id,
          rn.reminder_id,
          rn.title,
          rn.body,
          rn.status,
          rn.retries,
          rn.sent_at,
          rn.error_message,
          rn.created_at,
          mr.reminder_time,
          m.name AS medicine_name
        FROM reminder_notifications rn
        LEFT JOIN medicine_reminders mr ON mr.id = rn.reminder_id
        LEFT JOIN medicines m ON m.id = mr.medicine_id
        WHERE rn.user_id = $1::uuid
        ORDER BY COALESCE(rn.sent_at, rn.updated_at, rn.created_at) DESC
        LIMIT 100
      `,
      [userId]
    );

    return res.status(200).json({ history: rows });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch notification history',
      error: error.message,
    });
  }
};

module.exports = {
  getReminders,
  createReminder,
  completeReminder,
  registerDeviceToken,
  getNotificationHistory,
};
