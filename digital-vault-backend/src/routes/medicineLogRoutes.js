const express = require('express');
const { body } = require('express-validator');

const authMiddleware = require('../middleware/authMiddleware');
const checkCaretakerAccess = require('../middleware/checkCaretakerAccess');
const validateRequest = require('../middleware/validationMiddleware');
const {
  getTodayMedicines,
  markDoseTaken,
  markDoseMissed,
  getAdherenceSummary,
} = require('../controllers/medicineLogController');

const router = express.Router();

router.use(authMiddleware, checkCaretakerAccess);

router.get('/today', getTodayMedicines);
router.get('/adherence-summary', getAdherenceSummary);
router.post(
  '/mark-taken',
  [
    body('medicine_id').isUUID().withMessage('medicine_id must be a UUID'),
    body('scheduled_time').trim().matches(/^\d{2}:\d{2}$/).withMessage('scheduled_time must be HH:MM'),
    validateRequest,
  ],
  markDoseTaken
);
router.post(
  '/mark-missed',
  [
    body('medicine_id').isUUID().withMessage('medicine_id must be a UUID'),
    body('scheduled_time').trim().matches(/^\d{2}:\d{2}$/).withMessage('scheduled_time must be HH:MM'),
    validateRequest,
  ],
  markDoseMissed
);

module.exports = router;
