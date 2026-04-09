const express = require('express');
const { body } = require('express-validator');

const authMiddleware = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validationMiddleware');
const {
  triggerEmergency,
  getEmergencyStatus,
  grantEmergencyVaultAccess,
} = require('../controllers/emergencyController');

const router = express.Router();

router.use(authMiddleware);

router.post(
  '/trigger',
  [
    body('trigger_reason').optional().trim().isLength({ min: 3, max: 200 }).withMessage('trigger_reason must be 3-200 characters'),
    validateRequest,
  ],
  triggerEmergency
);

router.get('/status', getEmergencyStatus);

router.post(
  '/grant-access',
  [
    body('expires_in_hours').optional().isInt({ min: 1, max: 168 }).withMessage('expires_in_hours must be between 1 and 168'),
    validateRequest,
  ],
  grantEmergencyVaultAccess
);

module.exports = router;
