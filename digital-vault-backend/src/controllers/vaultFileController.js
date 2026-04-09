const fs = require('fs');
const path = require('path');
const {
  createVaultFile,
  getVaultFilesByUserId,
  getVaultFileById,
  getVaultFileByIdForUser,
  deleteVaultFileByIdForUser,
} = require('../models/vaultFileModel');
const { getActiveGrantByNomineeClaims } = require('../models/emergencyModel');
const { decryptFileToStream, encryptFileAtRest } = require('../services/vaultEncryptionService');
const { sendOk, sendError } = require('../utils/http');

const createStoredFilePath = (file) => `vault/${file.filename}.enc`;
const getUserId = (req) => req.user?.userId || req.user?.sub;

const getNomineeGrant = async (req) => {
  const nomineeAccess = req.user?.nomineeAccess;
  if (
    req.user?.role !== 'nominee' ||
    !nomineeAccess?.grantId ||
    !nomineeAccess?.nomineeId ||
    !nomineeAccess?.ownerUserId
  ) {
    return null;
  }

  return getActiveGrantByNomineeClaims({
    grantId: nomineeAccess.grantId,
    ownerUserId: nomineeAccess.ownerUserId,
    nomineeId: nomineeAccess.nomineeId,
  });
};

const isVerifiedNomineeSession = async (req) => {
  const nomineeGrant = await getNomineeGrant(req);
  return nomineeGrant || null;
};

const canAccessVaultFile = async ({ req, file }) => {
  const userId = getUserId(req);
  if (!userId || !file?.user_id) {
    return false;
  }

  if (String(file.user_id) === String(userId)) {
    return true;
  }

  const nomineeGrant = await isVerifiedNomineeSession(req);
  if (!nomineeGrant) {
    return false;
  }

  return String(file.user_id) === String(nomineeGrant.user_id);
};

const resolveVaultPath = (storedPath) => {
  const normalized = String(storedPath || '').replace(/\\/g, '/').trim();
  if (!normalized || normalized.includes('..')) {
    return null;
  }

  const withoutLeadingSlash = normalized.replace(/^\/+/, '');

  if (withoutLeadingSlash.startsWith('uploads/')) {
    return path.join(process.cwd(), withoutLeadingSlash);
  }

  if (withoutLeadingSlash.startsWith('vault/')) {
    return path.join(process.cwd(), 'storage', withoutLeadingSlash);
  }

  return path.join(process.cwd(), 'storage', withoutLeadingSlash);
};

const uploadVaultFile = async (req, res) => {
  let encryptedPath = null;

  try {
    console.log('[Vault Upload] req.file', req.file ? {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      filename: req.file.filename,
      destination: req.file.destination,
    } : null);

    const userId = getUserId(req);
    if (req.user?.role === 'nominee') {
      return sendError(res, 403, 'Nominee access is read-only');
    }

    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    if (!req.file) {
      return sendError(res, 400, 'file is required');
    }

    const rawFilePath = req.file.path;
    const storedFilePath = createStoredFilePath(req.file);
    encryptedPath = path.join(process.cwd(), 'storage', storedFilePath);
    fs.mkdirSync(path.dirname(encryptedPath), { recursive: true });

    const encryption = await encryptFileAtRest({
      sourcePath: rawFilePath,
      destinationPath: encryptedPath,
    });

    if (fs.existsSync(rawFilePath)) {
      fs.unlinkSync(rawFilePath);
    }

    const record = await createVaultFile({
      userId,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      fileUrl: storedFilePath,
      encryptionKeyId: encryption.encryptionKeyId,
      iv: encryption.ivHex,
      authTag: encryption.authTagHex,
    });

    return sendOk(
      res,
      {
        message: 'File uploaded successfully',
        data: record,
      },
      201
    );
  } catch (error) {
    console.log('[Vault Upload Error]', error.message);

    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    if (encryptedPath && fs.existsSync(encryptedPath)) {
      fs.unlinkSync(encryptedPath);
    }

    return sendError(res, 500, 'Failed to upload file');
  }
};

const getVaultFiles = async (req, res) => {
  try {
    const nomineeGrant = await isVerifiedNomineeSession(req);
    if (nomineeGrant) {
      const nomineeFiles = await getVaultFilesByUserId(nomineeGrant.user_id);

      return sendOk(res, {
        message: 'Files fetched successfully',
        data: nomineeFiles.map((file) => ({
          ...file,
          access_scope: 'nominee_emergency',
          read_only: true,
        })),
      });
    }

    const userId = getUserId(req);
    if (req.user?.role === 'nominee') {
      return sendError(res, 403, 'Nominee session is not active or verified');
    }

    if (!userId) {
      return sendError(res, 403, 'Access denied');
    }

    const ownFiles = await getVaultFilesByUserId(userId);

    return sendOk(res, {
      message: 'Files fetched successfully',
      data: ownFiles.map((file) => ({
        ...file,
        access_scope: 'owner',
      })),
    });
  } catch (error) {
    console.log('[Vault List Error]', error.message);
    return sendError(res, 500, 'Failed to fetch files');
  }
};

const viewVaultFile = async (req, res) => {
  try {
    const { id } = req.params;
    const nomineeGrant = await isVerifiedNomineeSession(req);
    const userId = getUserId(req);

    if (!userId) {
      return sendError(res, 403, 'Access denied');
    }

    if (req.user?.role === 'nominee' && !nomineeGrant) {
      return sendError(res, 403, 'Nominee session is not active or verified');
    }

    let file = null;

    if (!nomineeGrant) {
      file = await getVaultFileByIdForUser({ id, userId });
    }

    if (!file) {
      file = await getVaultFileById(id);
      if (!file) {
        return sendError(res, 404, 'File not found');
      }

      const allowed = await canAccessVaultFile({ req, file });
      if (!allowed) {
        console.warn('[Vault Access Denied]', {
          requestId: req.requestId,
          userId,
          role: req.user?.role,
          fileId: id,
        });
        return sendError(res, 403, 'Access denied');
      }
    }

    const absolutePath = resolveVaultPath(file.file_url);

    if (!absolutePath || !fs.existsSync(absolutePath)) {
      return sendError(res, 404, 'Encrypted file not found');
    }

    res.setHeader('Content-Type', file.file_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.file_name || 'vault-file')}"`);
    res.setHeader('Cache-Control', 'no-store');
    if (Number(file.file_size) > 0) {
      res.setHeader('Content-Length', String(file.file_size));
    }

    await decryptFileToStream({
      encryptedPath: absolutePath,
      encryptionKeyId: file.encryption_key_id,
      ivHex: file.iv,
      authTagHex: file.auth_tag,
      outputStream: res,
    });
  } catch (error) {
    console.log('[Vault View Error]', error.message);

    if (!res.headersSent) {
      return sendError(res, 500, 'Failed to view file');
    }

    res.destroy(error);
  }

  return null;
};

const deleteVaultFile = async (req, res) => {
  try {
    if (req.user?.role === 'nominee') {
      return sendError(res, 403, 'Nominee access is read-only');
    }

    const userId = getUserId(req);
    const { id } = req.params;

    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    const existing = await getVaultFileByIdForUser({ id, userId });

    if (!existing) {
      return sendError(res, 404, 'File not found');
    }

    const deleted = await deleteVaultFileByIdForUser({ id, userId });

    if (!deleted) {
      return sendError(res, 404, 'File not found');
    }

    const absolutePath = resolveVaultPath(existing.file_url);

    if (absolutePath && fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }

    return sendOk(res, {
      message: 'File deleted successfully',
      data: deleted,
    });
  } catch (error) {
    console.log('[Vault Delete Error]', error.message);
    return sendError(res, 500, 'Failed to delete file');
  }
};

module.exports = {
  uploadVaultFile,
  getVaultFiles,
  viewVaultFile,
  deleteVaultFile,
};
