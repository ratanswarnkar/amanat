const fs = require('fs');
const path = require('path');
const multer = require('multer');

const sanitizeFilename = (filename) =>
  filename.replace(/[^a-zA-Z0-9.-]/g, '_');

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const createUploader = (folderName) => {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      const uploadDir = path.join(process.cwd(), 'uploads', folderName);
      fs.mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      cb(null, `${Date.now()}-${sanitizeFilename(file.originalname)}`);
    },
  });

  return multer({
    storage,
    limits: {
      fileSize: MAX_FILE_SIZE_BYTES,
    },
    fileFilter: (_req, file, cb) => {
      const mimeType = String(file?.mimetype || '').toLowerCase();
      if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        return cb(new Error('Invalid file type. Only JPEG, PNG, and PDF are allowed.'));
      }
      cb(null, true);
    },
  });
};

module.exports = {
  createUploader,
};
