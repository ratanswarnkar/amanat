const pool = require('../config/db');

const normalizeMobile = (value = '') => String(value || '').replace(/\D/g, '').slice(-10);

const createNominee = async ({ userId, nomineeUserId = null, name, phone, relationship }) => {
  const { rows } = await pool.query(
    `
      INSERT INTO nominees (user_id, nominee_user_id, name, phone, relationship, status, approved_at)
      VALUES ($1::uuid, $2::uuid, $3::text, $4::text, $5::text, 'pending', NULL)
      RETURNING *
    `,
    [userId, nomineeUserId, name, phone, relationship]
  );

  return rows[0];
};

const getNomineesByUserId = async (userId) => {
  const { rows } = await pool.query(
    `
      SELECT
        n.id,
        n.user_id,
        n.nominee_user_id,
        n.name,
        n.phone,
        n.relationship,
        n.status,
        n.approved_at,
        n.dob,
        n.photo_url,
        n.is_active,
        n.created_at,
        n.updated_at,
        COALESCE(v.status, n.status) AS verification_status,
        v.verified_at,
        CASE WHEN COALESCE(v.status, n.status) = 'approved' THEN TRUE ELSE FALSE END AS is_verified
      FROM nominees n
      LEFT JOIN LATERAL (
        SELECT nv.status, nv.verified_at, nv.updated_at, nv.created_at
        FROM nominee_verifications nv
        WHERE nv.nominee_id = n.id
          AND nv.user_id = n.user_id
        ORDER BY COALESCE(nv.verified_at, nv.updated_at, nv.created_at) DESC
        LIMIT 1
      ) v ON TRUE
      WHERE n.user_id = $1::uuid
      ORDER BY n.created_at DESC
    `,
    [userId]
  );

  return rows;
};

const getNomineeByIdForUser = async ({ nomineeId, userId }) => {
  const { rows } = await pool.query(
    `
      SELECT *
      FROM nominees
      WHERE id = $1::uuid
        AND user_id = $2::uuid
      LIMIT 1
    `,
    [nomineeId, userId]
  );

  return rows[0] || null;
};

const deleteNomineeByIdForUser = async ({ nomineeId, userId }) => {
  const { rows } = await pool.query(
    `
      DELETE FROM nominees
      WHERE id = $1::uuid
        AND user_id = $2::uuid
      RETURNING *
    `,
    [nomineeId, userId]
  );

  return rows[0] || null;
};

const getLatestVerificationByNominee = async ({ nomineeId, userId }) => {
  const { rows } = await pool.query(
    `
      SELECT *
      FROM nominee_verifications
      WHERE nominee_id = $1::uuid
        AND user_id = $2::uuid
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [nomineeId, userId]
  );

  return rows[0] || null;
};

const getApprovedNomineeLinksByPhone = async (phone) => {
  const normalizedPhone = normalizeMobile(phone);
  if (!normalizedPhone) {
    return [];
  }

  const { rows } = await pool.query(
    `
      SELECT DISTINCT ON (n.id, n.user_id)
        n.id AS nominee_id,
        n.user_id AS owner_user_id,
        n.nominee_user_id,
        n.name AS nominee_name,
        n.phone AS nominee_phone,
        n.relationship,
        n.status AS nominee_status,
        n.approved_at,
        u.full_name AS owner_name,
        u.mobile AS owner_mobile,
        nv.id AS verification_id,
        nv.status AS verification_status,
        nv.verified_at
      FROM nominees n
      JOIN users u
        ON u.id = n.user_id
      JOIN nominee_verifications nv
        ON nv.nominee_id = n.id
       AND nv.user_id = n.user_id
      WHERE n.is_active = TRUE
        AND n.status = 'approved'
        AND nv.status = 'approved'
        AND RIGHT(regexp_replace(n.phone, '\\D', '', 'g'), 10) = $1::text
      ORDER BY n.id, n.user_id, COALESCE(nv.verified_at, nv.updated_at, nv.created_at) DESC
    `,
    [normalizedPhone]
  );

  return rows;
};

const createOrUpdateNomineeVerificationOtp = async ({ nomineeId, userId, otpHash, expiresAt, sentTo }) => {
  const latest = await getLatestVerificationByNominee({ nomineeId, userId });

  const payload = JSON.stringify({
    otp_hash: otpHash,
    otp_expires_at: new Date(expiresAt).toISOString(),
    otp_attempts: 0,
    otp_sent_to: sentTo,
  });

  if (latest) {
    const { rows } = await pool.query(
      `
        UPDATE nominee_verifications
        SET status = 'pending',
            verified_at = NULL,
            security_answers_json = (
              COALESCE(security_answers_json, '{}'::jsonb)
                - 'otp_hash'
                - 'otp_expires_at'
                - 'otp_attempts'
                - 'otp_sent_to'
                - 'otp_verified_at'
                - 'otp_last_result'
                - 'security_questions_verified_at'
                - 'security_question_attempts'
                - 'security_question_locked_until'
                - 'security_question_last_failed_at'
                - 'security_question_last_result'
                - 'security_question_correct_count'
                - 'security_question_keys'
            ) || $3::jsonb,
            updated_at = NOW()
        WHERE id = $1::uuid
          AND user_id = $2::uuid
        RETURNING *
      `,
      [latest.id, userId, payload]
    );

    return rows[0] || null;
  }

  const { rows } = await pool.query(
    `
      INSERT INTO nominee_verifications (
        nominee_id,
        user_id,
        status,
        security_answers_json,
        dob_verified,
        biometric_verified
      )
      VALUES (
        $1::uuid,
        $2::uuid,
        'pending',
        $3::jsonb,
        FALSE,
        FALSE
      )
      RETURNING *
    `,
    [nomineeId, userId, payload]
  );

  return rows[0] || null;
};

const markNomineeVerificationOtpVerified = async ({ verificationId, userId }) => {
  const payload = JSON.stringify({
    otp_verified_at: new Date().toISOString(),
    otp_last_result: 'passed',
  });

  const { rows } = await pool.query(
    `
      UPDATE nominee_verifications
      SET status = 'pending',
          verified_at = NULL,
          security_answers_json = (
            COALESCE(security_answers_json, '{}'::jsonb)
              - 'otp_hash'
              - 'otp_expires_at'
              - 'otp_attempts'
              - 'otp_sent_to'
          ) || $3::jsonb,
          updated_at = NOW()
      WHERE id = $1::uuid
        AND user_id = $2::uuid
      RETURNING *
    `,
    [verificationId, userId, payload]
  );

  return rows[0] || null;
};

const incrementNomineeVerificationOtpAttempts = async ({ verificationId, userId }) => {
  const { rows } = await pool.query(
    `
      UPDATE nominee_verifications
      SET security_answers_json = jsonb_set(
            COALESCE(security_answers_json, '{}'::jsonb),
            '{otp_attempts}',
            to_jsonb(COALESCE((security_answers_json->>'otp_attempts')::int, 0) + 1)
          ),
          updated_at = NOW()
      WHERE id = $1::uuid
        AND user_id = $2::uuid
      RETURNING *
    `,
    [verificationId, userId]
  );

  return rows[0] || null;
};

const recordNomineeSecurityQuestionFailure = async ({
  verificationId,
  userId,
  attempts,
  lockedUntil,
  correctCount,
}) => {
  const payload = JSON.stringify({
    security_question_attempts: attempts,
    security_question_locked_until: lockedUntil,
    security_question_last_failed_at: new Date().toISOString(),
    security_question_last_result: 'failed',
    security_question_correct_count: correctCount,
  });

  const { rows } = await pool.query(
    `
      UPDATE nominee_verifications
      SET status = CASE
            WHEN $4::text IS NULL THEN status
            ELSE 'pending'
          END,
          verified_at = NULL,
          security_answers_json = COALESCE(security_answers_json, '{}'::jsonb) || $3::jsonb,
          updated_at = NOW()
      WHERE id = $1::uuid
        AND user_id = $2::uuid
      RETURNING *
    `,
    [verificationId, userId, payload, lockedUntil]
  );

  return rows[0] || null;
};

const markNomineeSecurityQuestionsApproved = async ({
  verificationId,
  userId,
  correctCount,
  questionKeys,
}) => {
  const payload = JSON.stringify({
    security_questions_verified_at: new Date().toISOString(),
    security_question_last_result: 'passed',
    security_question_attempts: 0,
    security_question_locked_until: null,
    security_question_correct_count: correctCount,
    security_question_keys: questionKeys,
  });

  const { rows } = await pool.query(
    `
      UPDATE nominee_verifications
      SET status = 'approved',
          verified_at = NOW(),
          security_answers_json = COALESCE(security_answers_json, '{}'::jsonb) || $3::jsonb,
          updated_at = NOW()
      WHERE id = $1::uuid
        AND user_id = $2::uuid
      RETURNING *
    `,
    [verificationId, userId, payload]
  );

  return rows[0] || null;
};

const markNomineeVerificationApproved = async ({ verificationId, userId }) => {
  const { rows } = await pool.query(
    `
      UPDATE nominee_verifications
      SET status = 'approved',
          verified_at = NOW(),
          security_answers_json = COALESCE(security_answers_json, '{}'::jsonb)
            - 'otp_hash'
            - 'otp_expires_at',
          updated_at = NOW()
      WHERE id = $1::uuid
        AND user_id = $2::uuid
      RETURNING *
    `,
    [verificationId, userId]
  );

  return rows[0] || null;
};

const markNomineeApproved = async ({ nomineeId, userId, nomineeUserId = null }) => {
  const { rows } = await pool.query(
    `
      UPDATE nominees
      SET status = 'approved',
          approved_at = NOW(),
          nominee_user_id = COALESCE($3::uuid, nominee_user_id),
          updated_at = NOW()
      WHERE id = $1::uuid
        AND user_id = $2::uuid
      RETURNING *
    `,
    [nomineeId, userId, nomineeUserId]
  );

  return rows[0] || null;
};

module.exports = {
  createNominee,
  getNomineesByUserId,
  getNomineeByIdForUser,
  deleteNomineeByIdForUser,
  getLatestVerificationByNominee,
  getApprovedNomineeLinksByPhone,
  createOrUpdateNomineeVerificationOtp,
  markNomineeVerificationOtpVerified,
  incrementNomineeVerificationOtpAttempts,
  recordNomineeSecurityQuestionFailure,
  markNomineeSecurityQuestionsApproved,
  markNomineeVerificationApproved,
  markNomineeApproved,
};
