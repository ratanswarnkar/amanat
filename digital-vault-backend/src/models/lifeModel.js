const pool = require('../config/db');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const hasUsersIsActiveColumn = async () => {
  const { rows } = await pool.query(
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'is_active'
      LIMIT 1
    `
  );

  return rows.length > 0;
};

const setUserActiveState = async ({ userId, isActive }) => {
  const hasColumn = await hasUsersIsActiveColumn();
  if (!hasColumn) {
    return false;
  }

  await pool.query(
    `
      UPDATE users
      SET is_active = $1::boolean
      WHERE id = $2::uuid
    `,
    [Boolean(isActive), userId]
  );

  return true;
};

const getOrCreateUserLifeSettings = async (userId) => {
  const { rows } = await pool.query(
    `
      INSERT INTO user_life_settings (user_id)
      VALUES ($1::uuid)
      ON CONFLICT (user_id) DO UPDATE
      SET user_id = EXCLUDED.user_id
      RETURNING *
    `,
    [userId]
  );

  return rows[0] || null;
};

const updateUserLifeSettings = async ({
  userId,
  confirmationIntervalDays,
  adminOverrideState,
  adminOverrideUntil,
  adminOverrideReason,
  adminOverrideBy,
  clearAdminOverride = false,
  lastEvaluatedAt,
}) => {
  const existing = await getOrCreateUserLifeSettings(userId);
  const nextInterval = Number.isInteger(confirmationIntervalDays)
    ? confirmationIntervalDays
    : Number(existing?.confirmation_interval_days || 7);

  const nextOverrideState = clearAdminOverride
    ? null
    : adminOverrideState !== undefined
      ? adminOverrideState
      : existing?.admin_override_state || null;

  const nextOverrideUntil = clearAdminOverride
    ? null
    : adminOverrideUntil !== undefined
      ? adminOverrideUntil
      : existing?.admin_override_until || null;

  const nextOverrideReason = clearAdminOverride
    ? null
    : adminOverrideReason !== undefined
      ? adminOverrideReason
      : existing?.admin_override_reason || null;

  const nextOverrideBy = clearAdminOverride
    ? null
    : adminOverrideBy !== undefined
      ? adminOverrideBy
      : existing?.admin_override_by || null;

  const nextOverrideAt = clearAdminOverride
    ? null
    : adminOverrideState !== undefined || adminOverrideUntil !== undefined || adminOverrideReason !== undefined
      ? new Date()
      : existing?.admin_override_at || null;

  const nextEvaluatedAt = lastEvaluatedAt !== undefined
    ? lastEvaluatedAt
    : existing?.last_evaluated_at || null;

  const { rows } = await pool.query(
    `
      UPDATE user_life_settings
      SET confirmation_interval_days = $2::integer,
          admin_override_state = $3::text,
          admin_override_until = $4::timestamp,
          admin_override_reason = $5::text,
          admin_override_by = $6::uuid,
          admin_override_at = $7::timestamp,
          last_evaluated_at = $8::timestamp,
          updated_at = NOW()
      WHERE user_id = $1::uuid
      RETURNING *
    `,
    [
      userId,
      nextInterval,
      nextOverrideState,
      nextOverrideUntil,
      nextOverrideReason,
      nextOverrideBy,
      nextOverrideAt,
      nextEvaluatedAt,
    ]
  );

  return rows[0] || null;
};

const createLifeConfirmation = async ({ userId, source = 'mobile_app', status = 'confirmed_alive' }) => {
  const { rows } = await pool.query(
    `
      INSERT INTO life_confirmations (user_id, status, confirmed_at, source)
      VALUES ($1::uuid, $2::text, NOW(), $3::text)
      RETURNING *
    `,
    [userId, status, source]
  );

  return rows[0];
};

const getLatestLifeConfirmationByUserId = async (userId) => {
  const { rows } = await pool.query(
    `
      SELECT *
      FROM life_confirmations
      WHERE user_id = $1::uuid
      ORDER BY confirmed_at DESC
      LIMIT 1
    `,
    [userId]
  );

  return rows[0] || null;
};

const upsertLifeCheckConfirmedForToday = async ({ userId }) => {
  const { rows } = await pool.query(
    `
      INSERT INTO life_check_events (user_id, check_date, status, miss_count, created_at, updated_at)
      VALUES ($1::uuid, CURRENT_DATE, 'confirmed', 0, NOW(), NOW())
      ON CONFLICT (user_id, check_date)
      DO UPDATE
      SET status = 'confirmed',
          miss_count = 0,
          updated_at = NOW()
      RETURNING *
    `,
    [userId]
  );

  return rows[0] || null;
};

const upsertLifeCheckMissedForToday = async ({ userId }) => {
  const { rows } = await pool.query(
    `
      INSERT INTO life_check_events (user_id, check_date, status, miss_count, created_at, updated_at)
      VALUES ($1::uuid, CURRENT_DATE, 'missed', 1, NOW(), NOW())
      ON CONFLICT (user_id, check_date)
      DO UPDATE
      SET status = 'missed',
          miss_count = life_check_events.miss_count + 1,
          updated_at = NOW()
      RETURNING *
    `,
    [userId]
  );

  return rows[0] || null;
};

const getLifeStatusSummary = async ({ userId, thresholdDays }) => {
  const settings = await getOrCreateUserLifeSettings(userId);
  const latest = await getLatestLifeConfirmationByUserId(userId);
  const effectiveThresholdDays = Number(settings?.confirmation_interval_days || thresholdDays || 7);
  const overrideState = settings?.admin_override_state || null;
  const overrideUntil = settings?.admin_override_until || null;
  const overrideActive = Boolean(
    overrideState &&
    overrideUntil &&
    new Date(overrideUntil).getTime() > Date.now()
  );

  if (!latest?.confirmed_at) {
    return {
      settings,
      lastConfirmation: null,
      daysSinceLastConfirmation: null,
      thresholdDays: effectiveThresholdDays,
      isInactive: overrideActive ? overrideState === 'inactive' : false,
      overrideActive,
      overrideState: overrideActive ? overrideState : null,
      nextConfirmationDueAt: null,
    };
  }

  const now = new Date();
  const last = new Date(latest.confirmed_at);
  const daysSince = Math.floor((now.getTime() - last.getTime()) / MS_PER_DAY);
  const nextConfirmationDueAt = new Date(last.getTime() + effectiveThresholdDays * MS_PER_DAY);
  const computedInactive = daysSince >= effectiveThresholdDays;
  const isInactive = overrideActive ? overrideState === 'inactive' : computedInactive;

  return {
    settings,
    lastConfirmation: latest,
    daysSinceLastConfirmation: daysSince,
    thresholdDays: effectiveThresholdDays,
    isInactive,
    overrideActive,
    overrideState: overrideActive ? overrideState : null,
    nextConfirmationDueAt,
  };
};

const listLifeEvaluationCandidates = async () => {
  const { rows } = await pool.query(
    `
      SELECT
        u.id AS user_id,
        u.is_active,
        u.emergency_active,
        ls.confirmation_interval_days,
        ls.admin_override_state,
        ls.admin_override_until,
        ls.last_evaluated_at,
        lc.confirmed_at AS last_confirmation_at
      FROM users u
      LEFT JOIN user_life_settings ls
        ON ls.user_id = u.id
      LEFT JOIN LATERAL (
        SELECT confirmed_at
        FROM life_confirmations
        WHERE user_id = u.id
        ORDER BY confirmed_at DESC
        LIMIT 1
      ) lc ON TRUE
      WHERE u.role = 'user'
      ORDER BY u.created_at ASC
    `
  );

  return rows;
};

const createLifeAuditLog = async ({ targetUserId, actorUserId = null, actorType, action, details = {} }) => {
  const { rows } = await pool.query(
    `
      INSERT INTO life_audit_logs (target_user_id, actor_user_id, actor_type, action, details_json)
      VALUES ($1::uuid, $2::uuid, $3::text, $4::text, $5::jsonb)
      RETURNING *
    `,
    [targetUserId, actorUserId, actorType, action, JSON.stringify(details)]
  );

  return rows[0] || null;
};

const getLifeAuditLogsByUserId = async (userId, limit = 25) => {
  const { rows } = await pool.query(
    `
      SELECT *
      FROM life_audit_logs
      WHERE target_user_id = $1::uuid
      ORDER BY created_at DESC
      LIMIT $2::int
    `,
    [userId, limit]
  );

  return rows;
};

module.exports = {
  setUserActiveState,
  getOrCreateUserLifeSettings,
  updateUserLifeSettings,
  createLifeConfirmation,
  getLatestLifeConfirmationByUserId,
  upsertLifeCheckConfirmedForToday,
  upsertLifeCheckMissedForToday,
  getLifeStatusSummary,
  listLifeEvaluationCandidates,
  createLifeAuditLog,
  getLifeAuditLogsByUserId,
};
