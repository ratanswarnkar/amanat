const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

const SECRET_KEY = process.env.VAULT_SECRET || process.env.SECRET_KEY;

const getSecretKeyBuffer = () => {
  if (!SECRET_KEY) {
    throw new Error('VAULT_SECRET is not configured');
  }

  return crypto.createHash('sha256').update(String(SECRET_KEY).trim()).digest();
};

const encryptVaultValue = (value) => {
  const normalizedValue = String(value ?? '');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getSecretKeyBuffer(), iv);
  const encrypted = Buffer.concat([cipher.update(normalizedValue, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
};

const decryptVaultValue = (payload) => {
  const normalizedPayload = String(payload || '');
  const [ivHex, authTagHex, encryptedHex] = normalizedPayload.split(':');

  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error('Invalid encrypted vault payload');
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getSecretKeyBuffer(),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
};

module.exports = {
  SECRET_KEY,
  encryptVaultValue,
  decryptVaultValue,
};
