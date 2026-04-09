const express = require('express');
const { body, param } = require('express-validator');

const authMiddleware = require('../middleware/authMiddleware');
const checkCaretakerAccess = require('../middleware/checkCaretakerAccess');
const validateRequest = require('../middleware/validationMiddleware');
const {
  createScheduleEntry,
  getSchedules,
  updateScheduleEntry,
  deleteScheduleEntry,
} = require('../controllers/scheduleController');

const router = express.Router();

router.use(authMiddleware, checkCaretakerAccess);

router.post(
  '/',
  [
    body('medicine_name').trim().notEmpty().withMessage('medicine_name is required'),
    body('dosage').optional().isString().withMessage('dosage must be text'),
    body('time').isArray({ min: 1 }).withMessage('time must be an array with at least one value'),
    body('repeat_type')
      .optional()
      .isIn(['daily', 'weekly', 'custom'])
      .withMessage('repeat_type must be daily, weekly, or custom'),
    body('custom_pattern').optional().isArray().withMessage('custom_pattern must be an array'),
    validateRequest,
  ],
  createScheduleEntry
);

router.get('/', getSchedules);

router.put(
  '/:id',
  [
    param('id').isUUID().withMessage('valid schedule id is required'),
    body('medicine_name').optional().isString().withMessage('medicine_name must be text'),
    body('dosage').optional().isString().withMessage('dosage must be text'),
    body('time').optional().isArray({ min: 1 }).withMessage('time must be an array with at least one value'),
    body('repeat_type')
      .optional()
      .isIn(['daily', 'weekly', 'custom'])
      .withMessage('repeat_type must be daily, weekly, or custom'),
    body('custom_pattern').optional().isArray().withMessage('custom_pattern must be an array'),
    validateRequest,
  ],
  updateScheduleEntry
);

router.delete(
  '/:id',
  [param('id').isUUID().withMessage('valid schedule id is required'), validateRequest],
  deleteScheduleEntry
);

module.exports = router;
