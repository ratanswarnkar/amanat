const crypto = require('crypto');
const fs = require('fs');
const { pipeline } = require('stream');
const { promisify } = require('util');

const pipelineAsync = promisify(pipeline);
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

const decodeKey = (rawValue) => {
  const value = String(rawValue || '').trim();
  if (!value) return null;

  const hexCandidate = value.replace(/^hex:/i, '').trim();
  if (/^[0-9a-fA-F]{64}$/.test(hexCandidate)) {
    return Buffer.from(hexCandidate, 'hex');
  }

  const base64Candidate = value.replace(/^base64:/i, '').trim();
  try {
    const asBase64 = Buffer.from(base64Candidate, 'base64');
    if (asBase64.length === 32) {
      return asBase64;
    }
  } catch (_error) {
    // ignore and fallback
  }

  const asUtf8 = Buffer.from(value, 'utf8');
  if (asUtf8.length === 32) {
    return asUtf8;
  }

  return null;
};

const parseConfiguredKeys = () => {
  const fromJson = process.env.VAULT_ENCRYPTION_KEYS;

  if (fromJson) {
    try {
      const parsed = JSON.parse(fromJson);
      const map = new Map();

      Object.entries(parsed || {}).forEach(([keyId, rawKey]) => {
        const decoded = decodeKey(rawKey);
        if (decoded) {
          map.set(String(keyId), decoded);
        }
      });

      if (map.size > 0) {
        return map;
      }
    } catch (_error) {
      // ignore and fallback
    }
  }

  let fallbackKey = decodeKey(process.env.VAULT_MASTER_KEY);
  if (!fallbackKey) {
    const fallbackSecret = String(process.env.JWT_SECRET || process.env.ACCESS_TOKEN_SECRET || '').trim();
    if (fallbackSecret) {
      fallbackKey = crypto.createHash('sha256').update(fallbackSecret).digest();
    }
  }

  if (!fallbackKey) {
    throw new Error('Vault encryption key is missing. Set VAULT_MASTER_KEY (32-byte key, hex/base64/utf8) or VAULT_ENCRYPTION_KEYS JSON.');
  }

  return new Map([['default', fallbackKey]]);
};

const getActiveKey = () => {
  const keys = parseConfiguredKeys();
  const preferredKeyId = String(process.env.VAULT_ACTIVE_KEY_ID || '').trim();

  if (preferredKeyId && keys.has(preferredKeyId)) {
    return { keyId: preferredKeyId, key: keys.get(preferredKeyId) };
  }

  const first = [...keys.entries()][0];
  return { keyId: first[0], key: first[1] };
};

const getKeyById = (keyId) => {
  const keys = parseConfiguredKeys();
  return keys.get(String(keyId || '').trim()) || null;
};

const encryptFileAtRest = async ({ sourcePath, destinationPath }) => {
  const { keyId, key } = getActiveKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  await pipelineAsync(
    fs.createReadStream(sourcePath),
    cipher,
    fs.createWriteStream(destinationPath, { mode: 0o600 })
  );

  const authTag = cipher.getAuthTag();

  return {
    encryptionKeyId: keyId,
    ivHex: iv.toString('hex'),
    authTagHex: authTag.toString('hex'),
  };
};

const decryptFileToStream = async ({ encryptedPath, encryptionKeyId, ivHex, authTagHex, outputStream }) => {
  const key = getKeyById(encryptionKeyId);

  if (!key) {
    throw new Error('Encryption key not found for file');
  }

  const iv = Buffer.from(String(ivHex || ''), 'hex');
  const authTag = Buffer.from(String(authTagHex || ''), 'hex');

  if (iv.length !== 12 || authTag.length !== 16) {
    throw new Error('Invalid encryption metadata for file');
  }

  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  await pipelineAsync(fs.createReadStream(encryptedPath), decipher, outputStream);
};

module.exports = {
  encryptFileAtRest,
  decryptFileToStream,
};
