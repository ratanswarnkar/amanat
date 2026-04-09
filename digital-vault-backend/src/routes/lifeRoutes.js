const express = require('express');
const { body } = require('express-validator');

const authMiddleware = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validationMiddleware');
const { confirmLife, getLifeStatus, updateLifeSettings, adminOverrideLifeStatus } = require('../controllers/lifeController');

const router = express.Router();

router.use(authMiddleware);

router.post(
  '/confirm',
  [
    body('source').optional().trim().isLength({ min: 2, max: 50 }).withMessage('source must be 2-50 characters'),
    validateRequest,
  ],
  confirmLife
);

router.post(
  '/settings',
  [
    body('confirmation_interval_days')
      .isInt({ min: 1, max: 365 })
      .withMessage('confirmation_interval_days must be between 1 and 365'),
    validateRequest,
  ],
  updateLifeSettings
);

router.post(
  '/admin-override',
  [
    body('target_user_id').isUUID().withMessage('target_user_id must be a UUID'),
    body('action').isIn(['mark_active', 'mark_inactive']).withMessage('invalid admin override action'),
    body('reason').optional().trim().isLength({ max: 300 }).withMessage('reason must be up to 300 characters'),
    body('override_hours').optional().isInt({ min: 1, max: 720 }).withMessage('override_hours must be between 1 and 720'),
    validateRequest,
  ],
  adminOverrideLifeStatus
);

router.get('/status', getLifeStatus);

module.exports = router;
