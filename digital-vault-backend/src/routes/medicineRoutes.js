const express = require('express');
const { body, param } = require('express-validator');

const authMiddleware = require('../middleware/authMiddleware');
const checkCaretakerAccess = require('../middleware/checkCaretakerAccess');
const validateRequest = require('../middleware/validationMiddleware');
const {
  createMedicineSchedule,
  getMyMedicines,
  updateMedicine,
  deleteMedicine,
} = require('../controllers/medicineController');

const router = express.Router();

router.use(authMiddleware, checkCaretakerAccess);

router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('name is required'),
    body('times_per_day').optional().isInt({ min: 1 }).withMessage('times_per_day must be at least 1'),
    body('time_slots').optional().isArray().withMessage('time_slots must be an array'),
    body('start_date').optional().isISO8601().withMessage('start_date must be a valid date'),
    body('end_date').optional().isISO8601().withMessage('end_date must be a valid date'),
    validateRequest,
  ],
  createMedicineSchedule
);
router.get('/', getMyMedicines);
router.put(
  '/:id',
  [
    param('id').isUUID().withMessage('valid medicine id is required'),
    body('times_per_day').optional().isInt({ min: 1 }).withMessage('times_per_day must be at least 1'),
    body('time_slots').optional().isArray().withMessage('time_slots must be an array'),
    body('start_date').optional().isISO8601().withMessage('start_date must be a valid date'),
    body('end_date').optional().isISO8601().withMessage('end_date must be a valid date'),
    validateRequest,
  ],
  updateMedicine
);
router.delete(
  '/:id',
  [param('id').isUUID().withMessage('valid medicine id is required'), validateRequest],
  deleteMedicine
);

module.exports = router;
