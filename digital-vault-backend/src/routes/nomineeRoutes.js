const express = require('express');
const { body, param } = require('express-validator');

const authMiddleware = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validationMiddleware');
const {
  createNomineeEntry,
  listNominees,
  deleteNominee,
  sendNomineeVerification,
  verifyNomineeOtp,
} = require('../controllers/nomineeController');

const router = express.Router();

router.use(authMiddleware);

router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('name is required'),
    body('phone').trim().isLength({ min: 10, max: 15 }).withMessage('phone must be 10-15 characters'),
    body('relationship').trim().notEmpty().withMessage('relationship is required'),
    validateRequest,
  ],
  createNomineeEntry
);

router.get('/', listNominees);

router.delete(
  '/:id',
  [param('id').isUUID().withMessage('valid nominee id is required'), validateRequest],
  deleteNominee
);

router.post(
  '/send-verification',
  [body('nominee_id').isUUID().withMessage('nominee_id must be a UUID'), validateRequest],
  sendNomineeVerification
);

router.post(
  '/verify',
  [
    body('nominee_id').isUUID().withMessage('nominee_id must be a UUID'),
    body('otp').trim().matches(/^\d{6}$/).withMessage('otp must be a 6-digit code'),
    validateRequest,
  ],
  verifyNomineeOtp
);

module.exports = router;
