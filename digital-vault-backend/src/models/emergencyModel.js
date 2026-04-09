const crypto = require('crypto');
const pool = require('../config/db');

const normalizeMobile = (value = '') => String(value || '').replace(/\D/g, '').slice(-10);

const hasUsersEmergencyColumn = async () => {
  const { rows } = await pool.query(
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'emergency_active'
      LIMIT 1
    `
  );

  return rows.length > 0;
};

const setUserEmergencyActive = async ({ userId, emergencyActive }) => {
  const hasColumn = await hasUsersEmergencyColumn();
  if (!hasColumn) {
    return false;
  }

  await pool.query(
    `
      UPDATE users
      SET emergency_active = $1::boolean
      WHERE id = $2::uuid
    `,
    [Boolean(emergencyActive), userId]
  );

  return true;
};

const createEmergencyTrigger = async ({ userId, triggerReason }) => {
  const { rows } = await pool.query(
    `
      INSERT INTO emergency_triggers (user_id, trigger_reason, status, triggered_at)
      VALUES ($1::uuid, $2::text, 'active', NOW())
      RETURNING *
    `,
    [userId, triggerReason]
  );

  return rows[0];
};

const resolveActiveEmergencyTriggersByUserId = async ({ userId, resolutionStatus = 'resolved' }) => {
  const { rows } = await pool.query(
    `
      UPDATE emergency_triggers
      SET status = $2::text,
          resolved_at = NOW(),
          updated_at = NOW()
      WHERE user_id = $1::uuid
        AND status = 'active'
      RETURNING *
    `,
    [userId, resolutionStatus]
  );

  return rows;
};

const getActiveEmergencyTriggerByUserId = async (userId) => {
  const { rows } = await pool.query(
    `
      SELECT *
      FROM emergency_triggers
      WHERE user_id = $1::uuid
        AND status = 'active'
      ORDER BY triggered_at DESC
      LIMIT 1
    `,
    [userId]
  );

  return rows[0] || null;
};

const getVerifiedNomineesByUserId = async (userId) => {
  const { rows } = await pool.query(
    `
      SELECT DISTINCT ON (n.id)
        n.id,
        n.user_id,
        n.name,
        n.phone,
        n.relationship,
        nv.status AS verification_status,
        nv.verified_at
      FROM nominees n
      JOIN nominee_verifications nv
        ON nv.nominee_id = n.id
       AND nv.user_id = n.user_id
      WHERE n.user_id = $1::uuid
        AND n.is_active = TRUE
        AND n.status = 'approved'
        AND nv.status = 'approved'
      ORDER BY n.id, COALESCE(nv.verified_at, nv.updated_at, nv.created_at) DESC
    `,
    [userId]
  );

  return rows;
};

const getActiveGrantsByUserId = async (userId) => {
  const { rows } = await pool.query(
    `
      SELECT
        vag.id,
        vag.user_id,
        vag.nominee_id,
        vag.trigger_id,
        vag.token,
        vag.access_scope,
        vag.expires_at,
        vag.status,
        vag.created_at,
        n.name AS nominee_name,
        n.phone AS nominee_phone
      FROM vault_access_grants vag
      JOIN nominees n ON n.id = vag.nominee_id
      WHERE vag.user_id = $1::uuid
        AND vag.status = 'active'
        AND vag.expires_at > NOW()
      ORDER BY vag.created_at DESC
    `,
    [userId]
  );

  return rows;
};

const createOrReuseVaultAccessGrant = async ({ userId, nomineeId, triggerId, expiresAt }) => {
  const existing = await pool.query(
    `
      SELECT *
      FROM vault_access_grants
      WHERE user_id = $1::uuid
        AND nominee_id = $2::uuid
        AND trigger_id = $3::uuid
        AND status = 'active'
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [userId, nomineeId, triggerId]
  );

  if (existing.rows[0]) {
    return existing.rows[0];
  }

  const token = crypto.randomBytes(32).toString('hex');

  const { rows } = await pool.query(
    `
      INSERT INTO vault_access_grants (
        user_id,
        nominee_id,
        trigger_id,
        token,
        access_scope,
        expires_at,
        status
      )
      VALUES (
        $1::uuid,
        $2::uuid,
        $3::uuid,
        $4::text,
        'read_only',
        $5::timestamp,
        'active'
      )
      RETURNING *
    `,
    [userId, nomineeId, triggerId, token, expiresAt]
  );

  return rows[0];
};

const getAccessGrantByTokenAndPhone = async ({ accessToken, phone }) => {
  const normalizedPhone = normalizeMobile(phone);
  if (!accessToken || !normalizedPhone) {
    return null;
  }

  const { rows } = await pool.query(
    `
      SELECT
        vag.*,
        n.name AS nominee_name,
        RIGHT(regexp_replace(n.phone, '\\D', '', 'g'), 10) AS nominee_phone_normalized
      FROM vault_access_grants vag
      JOIN emergency_triggers et
        ON et.id = vag.trigger_id
       AND et.status = 'active'
      JOIN nominees n
        ON n.id = vag.nominee_id
       AND n.user_id = vag.user_id
       AND n.is_active = TRUE
       AND n.status = 'approved'
      JOIN LATERAL (
        SELECT nv.status
        FROM nominee_verifications nv
        WHERE nv.nominee_id = n.id
          AND nv.user_id = n.user_id
        ORDER BY COALESCE(nv.verified_at, nv.updated_at, nv.created_at) DESC
        LIMIT 1
      ) latest_verification ON TRUE
      WHERE vag.token = $1::text
        AND vag.status = 'active'
        AND vag.expires_at > NOW()
        AND vag.access_scope = 'read_only'
        AND latest_verification.status = 'approved'
        AND RIGHT(regexp_replace(n.phone, '\\D', '', 'g'), 10) = $2::text
      LIMIT 1
    `,
    [accessToken, normalizedPhone]
  );

  return rows[0] || null;
};

const getActiveGrantByNomineeClaims = async ({ grantId, ownerUserId, nomineeId }) => {
  const { rows } = await pool.query(
    `
      SELECT
        vag.*,
        n.name AS nominee_name,
        RIGHT(regexp_replace(n.phone, '\\D', '', 'g'), 10) AS nominee_phone_normalized
      FROM vault_access_grants vag
      JOIN emergency_triggers et
        ON et.id = vag.trigger_id
       AND et.status = 'active'
      JOIN nominees n
        ON n.id = vag.nominee_id
       AND n.user_id = vag.user_id
       AND n.is_active = TRUE
       AND n.status = 'approved'
      JOIN LATERAL (
        SELECT nv.status
        FROM nominee_verifications nv
        WHERE nv.nominee_id = n.id
          AND nv.user_id = n.user_id
        ORDER BY COALESCE(nv.verified_at, nv.updated_at, nv.created_at) DESC
        LIMIT 1
      ) latest_verification ON TRUE
      WHERE vag.id = $1::uuid
        AND vag.user_id = $2::uuid
        AND vag.nominee_id = $3::uuid
        AND vag.status = 'active'
        AND vag.expires_at > NOW()
        AND vag.access_scope = 'read_only'
        AND latest_verification.status = 'approved'
      LIMIT 1
    `,
    [grantId, ownerUserId, nomineeId]
  );

  return rows[0] || null;
};

module.exports = {
  setUserEmergencyActive,
  createEmergencyTrigger,
  resolveActiveEmergencyTriggersByUserId,
  getActiveEmergencyTriggerByUserId,
  getVerifiedNomineesByUserId,
  getActiveGrantsByUserId,
  createOrReuseVaultAccessGrant,
  getAccessGrantByTokenAndPhone,
  getActiveGrantByNomineeClaims,
};
