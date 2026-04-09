const {
  createVaultEntry,
  deleteVaultEntryByIdForUser,
  getVaultEntriesByUserId,
  getVaultEntryByIdForUser,
  updateVaultEntry,
} = require('../models/secureVaultModel');
const { decryptVaultValue, encryptVaultValue } = require('../services/secureVaultCryptoService');
const { sendError, sendOk } = require('../utils/http');

const getUserId = (req) => req.user?.userId || req.user?.sub;

const ensureWriteAccess = (req, res) => {
  if (req.user?.role === 'nominee') {
    sendError(res, 403, 'Nominee access is read-only');
    return false;
  }

  return true;
};

const normalizeFields = (fields = []) => {
  return fields
    .map((field) => ({
      label: String(field?.label || '').trim(),
      value: String(field?.value || '').trim(),
    }))
    .filter((field) => field.label && field.value);
};

const buildResponseEntry = (entry) => ({
  id: entry.id,
  user_id: entry.user_id,
  title: entry.title,
  type: entry.type,
  created_at: entry.created_at,
  updated_at: entry.updated_at,
  fields: entry.fields.map((field) => ({
    id: field.id,
    label: field.label,
    value: decryptVaultValue(field.encrypted_value),
  })),
});

const createEntry = async (req, res) => {
  try {
    if (!ensureWriteAccess(req, res)) {
      return null;
    }

    const userId = getUserId(req);
    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    const title = String(req.body?.title || '').trim();
    const type = String(req.body?.type || '').trim().toLowerCase();
    const fields = normalizeFields(req.body?.fields);

    const entryId = await createVaultEntry({
      userId,
      title,
      type,
      fields: fields.map((field) => ({
        label: field.label,
        encrypted_value: encryptVaultValue(field.value),
      })),
    });

    const entry = await getVaultEntryByIdForUser({ id: entryId, userId });

    return sendOk(
      res,
      {
        message: 'Vault entry created successfully',
        data: buildResponseEntry(entry),
      },
      201
    );
  } catch (error) {
    console.error('[Secure Vault Create Error]', error.message);
    return sendError(res, 500, 'Failed to create vault entry');
  }
};

const getEntries = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    const entries = await getVaultEntriesByUserId({
      userId,
      type: String(req.query?.type || '').trim().toLowerCase(),
      sort: String(req.query?.sort || 'latest').trim().toLowerCase(),
    });

    return sendOk(res, {
      message: 'Vault entries fetched successfully',
      data: entries.map(buildResponseEntry),
    });
  } catch (error) {
    console.error('[Secure Vault List Error]', error.message);
    return sendError(res, 500, 'Failed to fetch vault entries');
  }
};

const updateEntry = async (req, res) => {
  try {
    if (!ensureWriteAccess(req, res)) {
      return null;
    }

    const userId = getUserId(req);
    const { id } = req.params;

    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    const title = String(req.body?.title || '').trim();
    const type = String(req.body?.type || '').trim().toLowerCase();
    const fields = normalizeFields(req.body?.fields);

    const updatedId = await updateVaultEntry({
      id,
      userId,
      title,
      type,
      fields: fields.map((field) => ({
        label: field.label,
        encrypted_value: encryptVaultValue(field.value),
      })),
    });

    if (!updatedId) {
      return sendError(res, 404, 'Vault entry not found');
    }

    const entry = await getVaultEntryByIdForUser({ id, userId });

    return sendOk(res, {
      message: 'Vault entry updated successfully',
      data: buildResponseEntry(entry),
    });
  } catch (error) {
    console.error('[Secure Vault Update Error]', error.message);
    return sendError(res, 500, 'Failed to update vault entry');
  }
};

const deleteEntry = async (req, res) => {
  try {
    if (!ensureWriteAccess(req, res)) {
      return null;
    }

    const userId = getUserId(req);
    const { id } = req.params;

    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    const deleted = await deleteVaultEntryByIdForUser({ id, userId });

    if (!deleted) {
      return sendError(res, 404, 'Vault entry not found');
    }

    return sendOk(res, {
      message: 'Vault entry deleted successfully',
      data: deleted,
    });
  } catch (error) {
    console.error('[Secure Vault Delete Error]', error.message);
    return sendError(res, 500, 'Failed to delete vault entry');
  }
};

const searchEntries = async (req, res) => {
  try {
    const userId = getUserId(req);
    const query = String(req.query?.q || '').trim().toLowerCase();

    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    if (!query) {
      return sendOk(res, {
        message: 'Vault search completed',
        data: [],
      });
    }

    const entries = await getVaultEntriesByUserId({
      userId,
      type: String(req.query?.type || '').trim().toLowerCase(),
      sort: String(req.query?.sort || 'latest').trim().toLowerCase(),
      searchTerm: query,
    });

    return sendOk(res, {
      message: 'Vault search completed using entry titles and field labels only',
      data: entries.map(buildResponseEntry),
      search_scope: {
        title: true,
        field_labels: true,
        encrypted_values: false,
      },
    });
  } catch (error) {
    console.error('[Secure Vault Search Error]', error.message);
    return sendError(res, 500, 'Failed to search vault entries');
  }
};

module.exports = {
  createEntry,
  getEntries,
  updateEntry,
  deleteEntry,
  searchEntries,
};
