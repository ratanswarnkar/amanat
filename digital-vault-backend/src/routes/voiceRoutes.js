const express = require('express');
const { body } = require('express-validator');

const authMiddleware = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validationMiddleware');
const { createMedicineFromVoice } = require('../controllers/voiceController');

const router = express.Router();

router.use(authMiddleware);

router.post(
  '/medicine',
  [
    body('voice_text').trim().notEmpty().withMessage('voice_text is required'),
    validateRequest,
  ],
  createMedicineFromVoice
);

module.exports = router;
