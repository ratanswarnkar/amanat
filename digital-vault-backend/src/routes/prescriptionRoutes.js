const express = require('express');
const { body } = require('express-validator');

const authMiddleware = require('../middleware/authMiddleware');
const checkCaretakerAccess = require('../middleware/checkCaretakerAccess');
const validateRequest = require('../middleware/validationMiddleware');
const { createUploader } = require('../middleware/uploadMiddleware');
const {
  createPrescriptionEntry,
  getPrescriptions,
} = require('../controllers/prescriptionController');

const router = express.Router();
const upload = createUploader('prescriptions');

router.use(authMiddleware, checkCaretakerAccess);

router.post(
  '/',
  upload.single('file'),
  [
    body('doctor_name').trim().notEmpty().withMessage('doctor_name is required'),
    body('hospital_name').optional().trim(),
    body('issue_date').optional().isISO8601().withMessage('issue_date must be a valid date'),
    validateRequest,
  ],
  createPrescriptionEntry
);

router.get('/', getPrescriptions);

module.exports = router;
