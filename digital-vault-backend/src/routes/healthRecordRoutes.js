const express = require('express');
const { body, param } = require('express-validator');

const authMiddleware = require('../middleware/authMiddleware');
const checkCaretakerAccess = require('../middleware/checkCaretakerAccess');
const verifyPin = require('../middleware/verifyPin');
const validateRequest = require('../middleware/validationMiddleware');
const { createUploader } = require('../middleware/uploadMiddleware');
const { healthRecordFileLimiter } = require('../middleware/rateLimiters');
const {
  createHealthRecordEntry,
  getHealthRecords,
  getHealthRecord,
  streamHealthRecordFile,
  deleteHealthRecord,
} = require('../controllers/healthRecordController');

const router = express.Router();
const upload = createUploader('health-records');

router.use(authMiddleware, checkCaretakerAccess);

router.post(
  '/',
  upload.single('file'),
  [
    body('title').trim().notEmpty().withMessage('title is required'),
    body('record_type').trim().notEmpty().withMessage('record_type is required'),
    body('record_date').optional({ checkFalsy: true }).isISO8601().withMessage('record_date must be a valid date'),
    validateRequest,
  ],
  createHealthRecordEntry
);

router.get('/', getHealthRecords);

router.get(
  '/:id/file',
  healthRecordFileLimiter,
  verifyPin,
  [param('id').isUUID().withMessage('valid record id is required'), validateRequest],
  streamHealthRecordFile
);

router.get(
  '/:id',
  [param('id').isUUID().withMessage('valid record id is required'), validateRequest],
  getHealthRecord
);

router.delete(
  '/:id',
  verifyPin,
  [param('id').isUUID().withMessage('valid record id is required'), validateRequest],
  deleteHealthRecord
);

module.exports = router;
