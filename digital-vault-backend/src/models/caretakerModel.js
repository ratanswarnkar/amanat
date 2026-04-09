const pool = require('../config/db');

const normalizeMobile = (value = '') => String(value || '').replace(/\D/g, '').slice(-10);

const createCaretaker = async ({
  userId,
  caretakerUserId = null,
  name,
  phone,
  relationship,
  accessLevel,
  status = 'pending',
}) => {
  const { rows } = await pool.query(
    `
      INSERT INTO caretakers (user_id, caretaker_user_id, name, phone, relationship, access_level, status, approved_at)
      VALUES ($1::uuid, $2::uuid, $3::text, $4::text, $5::text, $6::text, $7::text, NULL)
      RETURNING *
    `,
    [userId, caretakerUserId, name, phone, relationship, accessLevel, status]
  );

  return rows[0];
};

const getCaretakerByOwnerAndCaretakerUser = async ({ userId, caretakerUserId }) => {
  const { rows } = await pool.query(
    `
      SELECT *
      FROM caretakers
      WHERE user_id = $1::uuid
        AND caretaker_user_id = $2::uuid
      LIMIT 1
    `,
    [userId, caretakerUserId]
  );

  return rows[0] || null;
};

const isApprovedCaretakerForPatient = async ({ caretakerUserId, patientUserId }) => {
  const { rows } = await pool.query(
    `
      SELECT 1
      FROM caretakers
      WHERE caretaker_user_id = $1::uuid
        AND user_id = $2::uuid
        AND status = 'approved'
      LIMIT 1
    `,
    [caretakerUserId, patientUserId]
  );

  return rows.length > 0;
};

const getApprovedCaretakerPatients = async ({ caretakerUserId }) => {
  const { rows } = await pool.query(
    `
      SELECT
        c.user_id AS patient_id,
        COALESCE(NULLIF(BTRIM(u.full_name), ''), 'Patient') AS patient_name,
        c.status
      FROM caretakers c
      JOIN users u
        ON u.id = c.user_id
      WHERE c.caretaker_user_id = $1::uuid
        AND c.status = 'approved'
      ORDER BY c.approved_at DESC NULLS LAST, c.created_at DESC
    `,
    [caretakerUserId]
  );

  return rows;
};

const createOrUpdateCaretakerLink = async ({
  userId,
  caretakerUserId,
  name,
  phone,
  relationship,
  accessLevel = 'view',
  otpHash,
  otpExpiresAt,
}) => {
  const existing = await getCaretakerByOwnerAndCaretakerUser({ userId, caretakerUserId });

  if (existing) {
    const { rows } = await pool.query(
      `
        UPDATE caretakers
        SET name = $3::text,
            phone = $4::text,
            relationship = COALESCE($5::text, relationship),
            access_level = COALESCE($6::text, access_level),
            status = 'pending',
            approved_at = NULL,
            verified_at = NULL,
            otp_hash = $7::text,
            otp_expires_at = $8::timestamp,
            otp_attempts = 0,
            updated_at = NOW()
        WHERE id = $1::uuid
          AND user_id = $2::uuid
        RETURNING *
      `,
      [existing.id, userId, name, phone, relationship || null, accessLevel || null, otpHash, otpExpiresAt]
    );

    return rows[0] || null;
  }

  const { rows } = await pool.query(
    `
      INSERT INTO caretakers (
        user_id,
        caretaker_user_id,
        name,
        phone,
        relationship,
        access_level,
        status,
        approved_at,
        otp_hash,
        otp_expires_at,
        otp_attempts,
        verified_at,
        updated_at
      )
      VALUES (
        $1::uuid,
        $2::uuid,
        $3::text,
        $4::text,
        COALESCE($5::text, 'caretaker'),
        $6::text,
        'pending',
        NULL,
        $7::text,
        $8::timestamp,
        0,
        NULL,
        NOW()
      )
      RETURNING *
    `,
    [userId, caretakerUserId, name, phone, relationship || null, accessLevel, otpHash, otpExpiresAt]
  );

  return rows[0] || null;
};

const getCaretakersByUserId = async (userId) => {
  const { rows } = await pool.query(
    `
      SELECT
        c.*,
        u.full_name AS caretaker_user_name,
        u.mobile AS caretaker_user_mobile,
        u.role AS caretaker_user_role
      FROM caretakers
      LEFT JOIN users u
        ON u.id = c.caretaker_user_id
      WHERE c.user_id = $1::uuid
      ORDER BY c.created_at DESC
    `,
    [userId]
  );

  return rows;
};

const getCaretakerByIdForUser = async ({ caretakerId, userId }) => {
  const { rows } = await pool.query(
    `
      SELECT *
      FROM caretakers
      WHERE id = $1::uuid
        AND user_id = $2::uuid
      LIMIT 1
    `,
    [caretakerId, userId]
  );

  return rows[0] || null;
};

const updateCaretakerById = async ({ caretakerId, userId, name, phone, relationship, accessLevel }) => {
  const { rows } = await pool.query(
    `
      UPDATE caretakers
      SET
        name = COALESCE($1, name),
        phone = COALESCE($2, phone),
        relationship = COALESCE($3, relationship),
        access_level = COALESCE($4, access_level),
        updated_at = NOW()
      WHERE id = $5::uuid AND user_id = $6::uuid
      RETURNING *
    `,
    [name ?? null, phone ? normalizeMobile(phone) : null, relationship ?? null, accessLevel ?? null, caretakerId, userId]
  );

  return rows[0] || null;
};

const incrementCaretakerOtpAttempts = async ({ caretakerId, userId }) => {
  const { rows } = await pool.query(
    `
      UPDATE caretakers
      SET otp_attempts = otp_attempts + 1,
          updated_at = NOW()
      WHERE id = $1::uuid
        AND user_id = $2::uuid
      RETURNING *
    `,
    [caretakerId, userId]
  );

  return rows[0] || null;
};

const markCaretakerApproved = async ({ caretakerId, userId }) => {
  const { rows } = await pool.query(
    `
      UPDATE caretakers
      SET status = 'approved',
          approved_at = NOW(),
          verified_at = NOW(),
          otp_hash = NULL,
          otp_expires_at = NULL,
          otp_attempts = 0,
          updated_at = NOW()
      WHERE id = $1::uuid
        AND user_id = $2::uuid
      RETURNING *
    `,
    [caretakerId, userId]
  );

  return rows[0] || null;
};

const deleteCaretakerById = async ({ caretakerId, userId }) => {
  const { rows } = await pool.query(
    `
      DELETE FROM caretakers
      WHERE id = $1::uuid AND user_id = $2::uuid
      RETURNING id
    `,
    [caretakerId, userId]
  );

  return rows[0] || null;
};

module.exports = {
  createCaretaker,
  createOrUpdateCaretakerLink,
  isApprovedCaretakerForPatient,
  getApprovedCaretakerPatients,
  getCaretakerByOwnerAndCaretakerUser,
  getCaretakersByUserId,
  getCaretakerByIdForUser,
  updateCaretakerById,
  incrementCaretakerOtpAttempts,
  markCaretakerApproved,
  deleteCaretakerById,
};
