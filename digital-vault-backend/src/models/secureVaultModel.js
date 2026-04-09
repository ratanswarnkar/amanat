const pool = require('../config/db');

const normalizeRows = (rows) => {
  const entries = new Map();

  rows.forEach((row) => {
    if (!entries.has(String(row.id))) {
      entries.set(String(row.id), {
        id: row.id,
        user_id: row.user_id,
        title: row.title,
        type: row.type,
        created_at: row.created_at,
        updated_at: row.updated_at,
        fields: [],
      });
    }

    if (row.field_id) {
      entries.get(String(row.id)).fields.push({
        id: row.field_id,
        label: row.field_label,
        encrypted_value: row.field_encrypted_value,
      });
    }
  });

  return Array.from(entries.values());
};

const getVaultEntriesByUserId = async ({
  userId,
  type,
  sort = 'latest',
  searchTerm,
}) => {
  const values = [userId];
  const filters = ['ve.user_id = $1'];

  if (type && type !== 'all') {
    values.push(type);
    filters.push(`ve.type = $${values.length}`);
  }

  if (searchTerm) {
    values.push(`%${searchTerm.toLowerCase()}%`);
    filters.push(`(
      lower(ve.title) LIKE $${values.length}
      OR EXISTS (
        SELECT 1
        FROM vault_fields vf_search
        WHERE vf_search.entry_id = ve.id
          AND lower(vf_search.label) LIKE $${values.length}
      )
    )`);
  }

  const orderDirection = sort === 'oldest' ? 'ASC' : 'DESC';

  const { rows } = await pool.query(
    `
      SELECT
        ve.id,
        ve.user_id,
        ve.title,
        ve.type,
        ve.created_at,
        ve.updated_at,
        vf.id AS field_id,
        vf.label AS field_label,
        vf.encrypted_value AS field_encrypted_value
      FROM vault_entries ve
      LEFT JOIN vault_fields vf
        ON vf.entry_id = ve.id
      WHERE ${filters.join(' AND ')}
      ORDER BY ve.updated_at ${orderDirection}, ve.created_at ${orderDirection}, vf.created_at ASC, vf.id ASC
    `,
    values
  );

  return normalizeRows(rows);
};

const getVaultEntryByIdForUser = async ({ id, userId }) => {
  const { rows } = await pool.query(
    `
      SELECT
        ve.id,
        ve.user_id,
        ve.title,
        ve.type,
        ve.created_at,
        ve.updated_at,
        vf.id AS field_id,
        vf.label AS field_label,
        vf.encrypted_value AS field_encrypted_value
      FROM vault_entries ve
      LEFT JOIN vault_fields vf
        ON vf.entry_id = ve.id
      WHERE ve.id = $1
        AND ve.user_id = $2
      ORDER BY vf.created_at ASC, vf.id ASC
    `,
    [id, userId]
  );

  const entries = normalizeRows(rows);
  return entries[0] || null;
};

const createVaultEntry = async ({ userId, title, type, fields }) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const entryResult = await client.query(
      `
        INSERT INTO vault_entries (user_id, title, type)
        VALUES ($1, $2, $3)
        RETURNING id
      `,
      [userId, title, type]
    );

    const entryId = entryResult.rows[0].id;

    for (const field of fields) {
      await client.query(
        `
          INSERT INTO vault_fields (entry_id, label, encrypted_value)
          VALUES ($1, $2, $3)
        `,
        [entryId, field.label, field.encrypted_value]
      );
    }

    await client.query('COMMIT');
    return entryId;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const updateVaultEntry = async ({ id, userId, title, type, fields }) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const updateResult = await client.query(
      `
        UPDATE vault_entries
        SET title = $3,
            type = $4,
            updated_at = NOW()
        WHERE id = $1
          AND user_id = $2
        RETURNING id
      `,
      [id, userId, title, type]
    );

    if (updateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query('DELETE FROM vault_fields WHERE entry_id = $1', [id]);

    for (const field of fields) {
      await client.query(
        `
          INSERT INTO vault_fields (entry_id, label, encrypted_value)
          VALUES ($1, $2, $3)
        `,
        [id, field.label, field.encrypted_value]
      );
    }

    await client.query('COMMIT');
    return id;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const deleteVaultEntryByIdForUser = async ({ id, userId }) => {
  const { rows } = await pool.query(
    `
      DELETE FROM vault_entries
      WHERE id = $1
        AND user_id = $2
      RETURNING id, user_id, title, type, created_at, updated_at
    `,
    [id, userId]
  );

  return rows[0] || null;
};

module.exports = {
  getVaultEntriesByUserId,
  getVaultEntryByIdForUser,
  createVaultEntry,
  updateVaultEntry,
  deleteVaultEntryByIdForUser,
};
