const path = require('path');

const SENSITIVE_UPLOAD_FOLDERS = new Set(['health-records', 'prescriptions']);

const normalizeSegments = (urlPath = '') =>
  String(urlPath || '')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

const sensitiveUploadAccess = (req, res, next) => {
  const [uploadsSegment, folderName] = normalizeSegments(req.path);

  if (uploadsSegment !== 'uploads' || !SENSITIVE_UPLOAD_FOLDERS.has(folderName)) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Direct access to sensitive uploads is not allowed',
  });
};

const resolveUploadPath = ({ fileUrl, expectedFolder }) => {
  const normalized = String(fileUrl || '').replace(/\\/g, '/').trim();
  if (!normalized || normalized.includes('..')) {
    return null;
  }

  const prefix = `/uploads/${expectedFolder}/`;
  if (!normalized.startsWith(prefix)) {
    return null;
  }

  const relativePath = normalized.slice('/uploads/'.length);
  const uploadsRoot = path.resolve(process.cwd(), 'uploads');
  const expectedRoot = path.resolve(process.cwd(), 'uploads', expectedFolder);
  const absolutePath = path.resolve(uploadsRoot, relativePath);
  const relativeToExpectedRoot = path.relative(expectedRoot, absolutePath);

  if (
    relativeToExpectedRoot.startsWith('..') ||
    path.isAbsolute(relativeToExpectedRoot)
  ) {
    return null;
  }

  return absolutePath;
};

module.exports = {
  sensitiveUploadAccess,
  resolveUploadPath,
};
