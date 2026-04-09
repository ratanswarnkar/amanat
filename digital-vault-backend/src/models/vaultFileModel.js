const pool = require('../config/db');

const createVaultFile = async ({
  userId,
  fileName,
  fileType,
  fileSize,
  fileUrl,
  encryptionKeyId,
  iv,
  authTag,
}) => {
  const { rows } = await pool.query(
    `
      INSERT INTO vault_files (user_id, file_name, file_type, file_size, file_url, encryption_key_id, iv, auth_tag)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
    [userId, fileName, fileType, fileSize, fileUrl, encryptionKeyId, iv, authTag]
  );

  return rows[0];
};

const getVaultFilesByUserId = async (userId) => {
  const { rows } = await pool.query(
    `
      SELECT id, user_id, file_name, file_type, file_size, file_url, created_at
      FROM vault_files
      WHERE user_id = $1
      ORDER BY created_at DESC
    `,
    [userId]
  );

  return rows;
};

const getVaultFileByIdForUser = async ({ id, userId }) => {
  const { rows } = await pool.query(
    `
      SELECT id, user_id, file_name, file_type, file_size, file_url, encryption_key_id, iv, auth_tag, created_at
      FROM vault_files
      WHERE id = $1
        AND user_id = $2
      LIMIT 1
    `,
    [id, userId]
  );

  return rows[0] || null;
};

const getVaultFileById = async (id) => {
  const { rows } = await pool.query(
    `
      SELECT id, user_id, file_name, file_type, file_size, file_url, encryption_key_id, iv, auth_tag, created_at
      FROM vault_files
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
};

const deleteVaultFileByIdForUser = async ({ id, userId }) => {
  const { rows } = await pool.query(
    `
      DELETE FROM vault_files
      WHERE id = $1
        AND user_id = $2
      RETURNING id, user_id, file_name, file_type, file_size, file_url, encryption_key_id, iv, auth_tag, created_at
    `,
    [id, userId]
  );

  return rows[0] || null;
};

module.exports = {
  createVaultFile,
  getVaultFilesByUserId,
  getVaultFileByIdForUser,
  getVaultFileById,
  deleteVaultFileByIdForUser,
};
