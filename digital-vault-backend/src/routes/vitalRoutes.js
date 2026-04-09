const express = require('express');
const { body } = require('express-validator');

const authMiddleware = require('../middleware/authMiddleware');
const checkCaretakerAccess = require('../middleware/checkCaretakerAccess');
const validateRequest = require('../middleware/validationMiddleware');
const { createVitalEntry, getVitals } = require('../controllers/vitalController');

const router = express.Router();

router.use(authMiddleware, checkCaretakerAccess);

router.post(
  '/',
  [
    body('type').trim().notEmpty().withMessage('type is required'),
    body('value').trim().notEmpty().withMessage('value is required'),
    body('unit').optional().trim(),
    body('recorded_at').optional().isISO8601().withMessage('recorded_at must be a valid timestamp'),
    validateRequest,
  ],
  createVitalEntry
);

router.get('/', getVitals);

module.exports = router;
