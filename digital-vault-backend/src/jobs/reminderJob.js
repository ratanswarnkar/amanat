const cron = require('node-cron');
const pool = require('../config/db');
const { sendExpoPushNotification } = require('../services/notificationService');

const MAX_NOTIFICATION_RETRIES = 3;

const normalizeTime = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    return null;
  }

  const hours = String(Number(match[1])).padStart(2, '0');
  const minutes = match[2];
  return `${hours}:${minutes}`;
};

const normalizeSlots = (timeSlots) => {
  let slots = [];

  if (Array.isArray(timeSlots)) {
    slots = timeSlots;
  } else if (typeof timeSlots === 'string') {
    try {
      const parsed = JSON.parse(timeSlots);
      slots = Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      slots = [];
    }
  }

  return slots
    .map((slot) => normalizeTime(slot))
    .filter(Boolean);
};

const buildReminderDate = (createdAt, reminderTime) => {
  const normalizedTime = normalizeTime(reminderTime);
  if (!normalizedTime) {
    return null;
  }

  const [hours, minutes] = normalizedTime.split(':').map(Number);
  const reminderDate = new Date(createdAt);
  reminderDate.setHours(hours, minutes, 0, 0);
  return reminderDate;
};

const formatReminderTimeForDb = (hhmm) => `${hhmm}:00`;

const insertPendingReminder = async ({ medicineId, userId, reminderTime }) => {
  const normalized = normalizeTime(reminderTime);
  if (!normalized) {
    return false;
  }

  const timeForDb = formatReminderTimeForDb(normalized);
  const scheduleTime = normalized;
  const params = [medicineId, userId, timeForDb, scheduleTime];

  try {
    const result = await pool.query(
      `
        INSERT INTO medicine_reminders (medicine_id, user_id, reminder_time, status)
        SELECT $1::uuid, $2::uuid, $3, 'pending'
        WHERE NOT EXISTS (
          SELECT 1
          FROM medicine_reminders
          WHERE medicine_id = $1::uuid
            AND user_id = $2::uuid
            AND LEFT(reminder_time::text, 5) = $4
            AND DATE(created_at) = CURRENT_DATE
        )
        AND NOT EXISTS (
          SELECT 1
          FROM medicine_logs
          WHERE medicine_id = $1::uuid
            AND user_id = $2::uuid
            AND scheduled_time = $4
            AND DATE(created_at) = CURRENT_DATE
            AND status IN ('taken', 'missed')
        )
        RETURNING id
      `,
      params
    );

    return result.rowCount > 0;
  } catch (error) {
    console.error('Reminder insert error:', error.message);
    console.error('Reminder insert params:', params);
    throw error;
  }
};

const autoMarkMissedDoses = async () => {
  const { rows: pendingReminders } = await pool.query(
    `
      SELECT
        r.id,
        r.medicine_id,
        r.user_id,
        r.reminder_time,
        r.created_at,
        latest_log.status AS latest_status
      FROM medicine_reminders r
      LEFT JOIN LATERAL (
        SELECT status
        FROM medicine_logs l
        WHERE l.medicine_id = r.medicine_id
          AND l.user_id = r.user_id
          AND l.scheduled_time = LEFT(r.reminder_time::text, 5)
          AND DATE(l.created_at) = DATE(r.created_at)
        ORDER BY l.created_at DESC
        LIMIT 1
      ) latest_log ON TRUE
      WHERE r.status = 'pending'
    `
  );

  const now = new Date();

  for (const reminder of pendingReminders) {
    const scheduledAt = buildReminderDate(reminder.created_at, reminder.reminder_time);
    if (!scheduledAt) {
      continue;
    }

    const isOverdue = now.getTime() - scheduledAt.getTime() >= 30 * 60 * 1000;
    const latestStatus = reminder.latest_status || 'pending';

    if (!isOverdue || latestStatus !== 'pending') {
      continue;
    }

    await pool.query(
      `
        INSERT INTO medicine_logs (
          id,
          medicine_id,
          user_id,
          scheduled_time,
          status,
          taken_at
        )
        VALUES (gen_random_uuid(), $1::uuid, $2::uuid, LEFT($3::text, 5), 'missed', NULL)
      `,
      [reminder.medicine_id, reminder.user_id, reminder.reminder_time]
    );

    await pool.query(
      `
        UPDATE medicine_reminders
        SET status = 'missed'
        WHERE id = $1::uuid
      `,
      [reminder.id]
    );
  }
};

const queueNotificationForToken = async ({ reminder, deviceToken }) => {
  const title = 'Medicine Reminder';
  const body = `Time to take ${reminder.medicine_name} at ${reminder.reminder_time}`;

  const { rows } = await pool.query(
    `
      INSERT INTO reminder_notifications (
        reminder_id,
        user_id,
        device_token_id,
        scheduled_date,
        title,
        body,
        payload,
        status,
        retries,
        created_at,
        updated_at
      )
      VALUES (
        $1::uuid,
        $2::uuid,
        $3::uuid,
        $4::date,
        $5::text,
        $6::text,
        $7::jsonb,
        'pending',
        0,
        NOW(),
        NOW()
      )
      ON CONFLICT (reminder_id, device_token_id, scheduled_date)
      DO NOTHING
      RETURNING id, retries
    `,
    [
      reminder.id,
      reminder.user_id,
      deviceToken.id,
      reminder.local_date,
      title,
      body,
      JSON.stringify({
        reminder_id: reminder.id,
        medicine_id: reminder.medicine_id,
        medicine_name: reminder.medicine_name,
      }),
    ]
  );

  return rows[0] || null;
};

const markNotificationSent = async (notificationId) => {
  await pool.query(
    `
      UPDATE reminder_notifications
      SET status = 'sent',
          sent_at = NOW(),
          next_retry_at = NULL,
          error_message = NULL,
          updated_at = NOW()
      WHERE id = $1::uuid
    `,
    [notificationId]
  );
};

const markNotificationFailed = async ({ notificationId, retries, errorMessage }) => {
  const nextRetryCount = Number(retries || 0) + 1;
  const hasRetryLeft = nextRetryCount < MAX_NOTIFICATION_RETRIES;
  const retryDelayMinutes = Math.min(30, 2 ** nextRetryCount);

  await pool.query(
    `
      UPDATE reminder_notifications
      SET status = 'failed',
          retries = $2::integer,
          next_retry_at = CASE
            WHEN $3::boolean THEN NOW() + ($4::text || ' minutes')::interval
            ELSE NULL
          END,
          error_message = $5::text,
          updated_at = NOW()
      WHERE id = $1::uuid
    `,
    [notificationId, nextRetryCount, hasRetryLeft, String(retryDelayMinutes), errorMessage]
  );
};

const sendQueuedNotification = async ({ notificationId, retries, expoPushToken, title, body, payload }) => {
  try {
    const result = await sendExpoPushNotification({
      token: expoPushToken,
      title,
      body,
      data: payload,
    });

    if (result.success) {
      await markNotificationSent(notificationId);
      return;
    }

    await markNotificationFailed({
      notificationId,
      retries,
      errorMessage: result.error || 'Push delivery failed',
    });
  } catch (error) {
    await markNotificationFailed({
      notificationId,
      retries,
      errorMessage: error.message || 'Push send error',
    });
  }
};

const processDueReminderNotifications = async () => {
  const { rows: dueReminders } = await pool.query(
    `
      WITH latest_tz AS (
        SELECT DISTINCT ON (udt.user_id)
          udt.user_id,
          COALESCE(NULLIF(udt.timezone, ''), 'Asia/Kolkata') AS timezone
        FROM user_device_tokens udt
        WHERE udt.is_active = TRUE
        ORDER BY udt.user_id, udt.updated_at DESC
      )
      SELECT
        r.id,
        r.user_id,
        r.medicine_id,
        LEFT(r.reminder_time::text, 5) AS reminder_time,
        m.name AS medicine_name,
        COALESCE(lt.timezone, 'Asia/Kolkata') AS timezone,
        DATE(NOW() AT TIME ZONE COALESCE(lt.timezone, 'Asia/Kolkata')) AS local_date
      FROM medicine_reminders r
      JOIN medicines m ON m.id = r.medicine_id
      LEFT JOIN latest_tz lt ON lt.user_id = r.user_id
      WHERE r.status = 'pending'
        AND DATE(r.created_at AT TIME ZONE COALESCE(lt.timezone, 'Asia/Kolkata')) = DATE(NOW() AT TIME ZONE COALESCE(lt.timezone, 'Asia/Kolkata'))
        AND LEFT(r.reminder_time::text, 5) = TO_CHAR(NOW() AT TIME ZONE COALESCE(lt.timezone, 'Asia/Kolkata'), 'HH24:MI')
    `
  );

  for (const reminder of dueReminders) {
    const { rows: deviceTokens } = await pool.query(
      `
        SELECT id, token
        FROM user_device_tokens
        WHERE user_id = $1::uuid
          AND is_active = TRUE
      `,
      [reminder.user_id]
    );

    for (const deviceToken of deviceTokens) {
      const queued = await queueNotificationForToken({ reminder, deviceToken });
      if (!queued) {
        continue;
      }

      await sendQueuedNotification({
        notificationId: queued.id,
        retries: queued.retries,
        expoPushToken: deviceToken.token,
        title: 'Medicine Reminder',
        body: `Time to take ${reminder.medicine_name} at ${reminder.reminder_time}`,
        payload: {
          reminder_id: reminder.id,
          medicine_id: reminder.medicine_id,
          medicine_name: reminder.medicine_name,
          scheduled_time: reminder.reminder_time,
        },
      });
    }
  }
};

const processFailedNotificationRetries = async () => {
  const { rows: failedNotifications } = await pool.query(
    `
      SELECT
        rn.id,
        rn.retries,
        rn.title,
        rn.body,
        rn.payload,
        udt.token AS expo_push_token
      FROM reminder_notifications rn
      JOIN user_device_tokens udt ON udt.id = rn.device_token_id
      WHERE rn.status = 'failed'
        AND rn.retries < $1::integer
        AND (rn.next_retry_at IS NULL OR rn.next_retry_at <= NOW())
        AND udt.is_active = TRUE
      ORDER BY rn.updated_at ASC
      LIMIT 200
    `,
    [MAX_NOTIFICATION_RETRIES]
  );

  for (const item of failedNotifications) {
    await sendQueuedNotification({
      notificationId: item.id,
      retries: item.retries,
      expoPushToken: item.expo_push_token,
      title: item.title,
      body: item.body,
      payload: item.payload,
    });
  }
};

cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const { rows: medicines } = await pool.query(`
      SELECT id, user_id, name, time_slots
      FROM medicines
    `);

    for (const medicine of medicines) {
      const slots = normalizeSlots(medicine.time_slots);
      if (!slots.includes(currentTime)) {
        continue;
      }

      await insertPendingReminder({
        medicineId: medicine.id,
        userId: medicine.user_id,
        reminderTime: currentTime,
      });
    }

    await processDueReminderNotifications();
    await processFailedNotificationRetries();
    await autoMarkMissedDoses();
  } catch (error) {
    console.error('Reminder engine error:', error.message);
  }
});
