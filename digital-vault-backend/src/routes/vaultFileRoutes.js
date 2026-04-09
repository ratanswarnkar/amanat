const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const { body, param, query } = require('express-validator');

const authMiddleware = require('../middleware/authMiddleware');
const restrictNomineeWrite = require('../middleware/restrictNomineeWrite');
const validateRequest = require('../middleware/validationMiddleware');
const {
  uploadVaultFile,
  getVaultFiles,
  viewVaultFile,
  deleteVaultFile,
} = require('../controllers/vaultFileController');
const {
  createEntry,
  getEntries,
  updateEntry,
  deleteEntry,
  searchEntries,
} = require('../controllers/secureVaultController');

const router = express.Router();

const uploadDir = path.join(process.cwd(), 'storage', 'tmp', 'vault');
fs.mkdirSync(uploadDir, { recursive: true });

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'application/pdf',
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const safeExt = ext && ext.length <= 10 ? ext : '';
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExt}`);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(String(file.mimetype || '').toLowerCase())) {
      return cb(new Error('Unsupported file type'));
    }

    cb(null, true);
  },
});

router.use(authMiddleware);

const entryValidators = [
  body('title').trim().notEmpty().withMessage('title is required'),
  body('type')
    .trim()
    .isIn(['password', 'bank', 'custom'])
    .withMessage('type must be password, bank, or custom'),
  body('fields').isArray({ min: 1 }).withMessage('at least one field is required'),
  body('fields.*.label').trim().notEmpty().withMessage('field label is required'),
  body('fields.*.value').trim().notEmpty().withMessage('field value is required'),
  validateRequest,
];

router.post('/upload', restrictNomineeWrite, (req, res, next) => {
  upload.single('file')(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'File too large. Max size is 10MB' });
    }

    return res.status(400).json({ success: false, message: error.message || 'Invalid upload request' });
  });
}, uploadVaultFile);

router.post('/create', restrictNomineeWrite, entryValidators, createEntry);
router.get(
  '/search',
  [
    query('q').trim().notEmpty().withMessage('search query is required'),
    query('type').optional().trim().isIn(['all', 'password', 'bank', 'custom']).withMessage('invalid type filter'),
    query('sort').optional().trim().isIn(['latest', 'oldest']).withMessage('invalid sort option'),
    validateRequest,
  ],
  searchEntries
);
router.get(
  '/',
  [
    query('type').optional().trim().isIn(['all', 'password', 'bank', 'custom']).withMessage('invalid type filter'),
    query('sort').optional().trim().isIn(['latest', 'oldest']).withMessage('invalid sort option'),
    validateRequest,
  ],
  getEntries
);
router.get('/files', getVaultFiles);
router.get(
  '/files/:id/view',
  [param('id').isUUID().withMessage('valid file id is required'), validateRequest],
  viewVaultFile
);

router.delete(
  '/files/:id',
  restrictNomineeWrite,
  [param('id').isUUID().withMessage('valid file id is required'), validateRequest],
  deleteVaultFile
);
router.put(
  '/:id',
  restrictNomineeWrite,
  [param('id').isUUID().withMessage('valid entry id is required'), ...entryValidators],
  updateEntry
);
router.delete(
  '/:id',
  restrictNomineeWrite,
  [param('id').isUUID().withMessage('valid entry id is required'), validateRequest],
  deleteEntry
);

module.exports = router;
