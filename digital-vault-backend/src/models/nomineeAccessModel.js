const pool = require('../config/db');

const getNomineeAccessChallenge = async ({ nomineeUserId, nomineeId, ownerUserId }) => {
  const { rows } = await pool.query(
    `
      SELECT *
      FROM nominee_access_challenges
      WHERE nominee_user_id = $1::uuid
        AND nominee_id = $2::uuid
        AND owner_user_id = $3::uuid
      LIMIT 1
    `,
    [nomineeUserId, nomineeId, ownerUserId]
  );

  return rows[0] || null;
};

const upsertNomineeAccessChallenge = async ({
  nomineeUserId,
  nomineeId,
  ownerUserId,
  challengeExpiresAt,
}) => {
  const { rows } = await pool.query(
    `
      INSERT INTO nominee_access_challenges (
        nominee_user_id,
        nominee_id,
        owner_user_id,
        challenge_expires_at,
        question_attempts,
        completed_at,
        updated_at
      )
      VALUES ($1::uuid, $2::uuid, $3::uuid, $4::timestamp, 0, NULL, NOW())
      ON CONFLICT (nominee_user_id, nominee_id, owner_user_id)
      DO UPDATE
      SET challenge_expires_at = EXCLUDED.challenge_expires_at,
          question_attempts = CASE
            WHEN nominee_access_challenges.locked_until IS NOT NULL
             AND nominee_access_challenges.locked_until <= NOW()
            THEN 0
            ELSE nominee_access_challenges.question_attempts
          END,
          locked_until = CASE
            WHEN nominee_access_challenges.locked_until IS NOT NULL
             AND nominee_access_challenges.locked_until <= NOW()
            THEN NULL
            ELSE nominee_access_challenges.locked_until
          END,
          completed_at = NULL,
          updated_at = NOW()
      RETURNING *
    `,
    [nomineeUserId, nomineeId, ownerUserId, challengeExpiresAt]
  );

  return rows[0] || null;
};

const recordNomineeChallengeFailure = async ({
  nomineeUserId,
  nomineeId,
  ownerUserId,
  attempts,
  lockedUntil,
}) => {
  const { rows } = await pool.query(
    `
      UPDATE nominee_access_challenges
      SET question_attempts = $4::integer,
          locked_until = $5::timestamp,
          last_failed_at = NOW(),
          updated_at = NOW()
      WHERE nominee_user_id = $1::uuid
        AND nominee_id = $2::uuid
        AND owner_user_id = $3::uuid
      RETURNING *
    `,
    [nomineeUserId, nomineeId, ownerUserId, attempts, lockedUntil]
  );

  return rows[0] || null;
};

const markNomineeChallengeCompleted = async ({ nomineeUserId, nomineeId, ownerUserId }) => {
  const { rows } = await pool.query(
    `
      UPDATE nominee_access_challenges
      SET question_attempts = 0,
          locked_until = NULL,
          completed_at = NOW(),
          updated_at = NOW()
      WHERE nominee_user_id = $1::uuid
        AND nominee_id = $2::uuid
        AND owner_user_id = $3::uuid
      RETURNING *
    `,
    [nomineeUserId, nomineeId, ownerUserId]
  );

  return rows[0] || null;
};

const createNomineeAccessAuditLog = async ({
  nomineeUserId = null,
  nomineeId = null,
  ownerUserId = null,
  actorType,
  action,
  details = {},
}) => {
  const { rows } = await pool.query(
    `
      INSERT INTO nominee_access_audit_logs (
        nominee_user_id,
        nominee_id,
        owner_user_id,
        actor_type,
        action,
        details_json
      )
      VALUES ($1::uuid, $2::uuid, $3::uuid, $4::text, $5::text, $6::jsonb)
      RETURNING *
    `,
    [nomineeUserId, nomineeId, ownerUserId, actorType, action, JSON.stringify(details)]
  );

  return rows[0] || null;
};

module.exports = {
  getNomineeAccessChallenge,
  upsertNomineeAccessChallenge,
  recordNomineeChallengeFailure,
  markNomineeChallengeCompleted,
  createNomineeAccessAuditLog,
};
