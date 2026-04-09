const express = require('express');
const { body, param } = require('express-validator');

const authMiddleware = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validationMiddleware');
const {
  createCaretakerEntry,
  verifyCaretaker,
  getCaretakers,
  deleteCaretaker,
} = require('../controllers/caretakerController');

const router = express.Router();

router.use(authMiddleware);

router.post(
  '/add',
  [
    body('phone').trim().isLength({ min: 10, max: 15 }).withMessage('phone must be 10-15 characters'),
    body('relationship').optional().trim(),
    body('access_level').optional().trim().isIn(['view', 'edit', 'full']).withMessage('invalid access_level'),
    validateRequest,
  ],
  createCaretakerEntry
);

router.post(
  '/verify',
  [
    body('caretaker_id').isUUID().withMessage('valid caretaker_id is required'),
    body('otp').trim().matches(/^\d{6}$/).withMessage('otp must be a 6-digit code'),
    validateRequest,
  ],
  verifyCaretaker
);

router.get('/', getCaretakers);

router.delete(
  '/:id',
  [param('id').isUUID().withMessage('valid caretaker id is required'), validateRequest],
  deleteCaretaker
);

module.exports = router;
