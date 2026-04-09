const express = require('express');
const { body, param } = require('express-validator');

const authMiddleware = require('../middleware/authMiddleware');
const checkCaretakerAccess = require('../middleware/checkCaretakerAccess');
const validateRequest = require('../middleware/validationMiddleware');
const {
  createInventory,
  getInventory,
  patchInventory,
  getLowStockInventory,
} = require('../controllers/inventoryController');

const router = express.Router();

router.use(authMiddleware, checkCaretakerAccess);

router.get('/low-stock', getLowStockInventory);

router.post(
  '/',
  [
    body('medicine_id').isUUID().withMessage('medicine_id must be a UUID'),
    body('quantity_total').isInt({ min: 0 }).withMessage('quantity_total must be a non-negative integer'),
    body('quantity_remaining').isInt({ min: 0 }).withMessage('quantity_remaining must be a non-negative integer'),
    body('refill_threshold').isInt({ min: 0 }).withMessage('refill_threshold must be a non-negative integer'),
    validateRequest,
  ],
  createInventory
);

router.get('/', getInventory);

router.patch(
  '/:medicineId',
  [
    param('medicineId').isUUID().withMessage('medicineId must be a UUID'),
    body('quantity_total').optional().isInt({ min: 0 }).withMessage('quantity_total must be a non-negative integer'),
    body('quantity_remaining').optional().isInt({ min: 0 }).withMessage('quantity_remaining must be a non-negative integer'),
    body('refill_threshold').optional().isInt({ min: 0 }).withMessage('refill_threshold must be a non-negative integer'),
    validateRequest,
  ],
  patchInventory
);

module.exports = router;
