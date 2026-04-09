const express = require('express');
const { param, query } = require('express-validator');

const requireAdmin = require('../middleware/requireAdmin');
const validateRequest = require('../middleware/validationMiddleware');
const { adminLoginLimiter } = require('../middleware/rateLimiters');
const { bootstrapAdmin } = require('../controllers/adminBootstrapController');
const {
  adminLogin,
  getUsers,
  getUserById,
  blockUser,
  unblockUser,
} = require('../controllers/adminController');

const router = express.Router();

router.post('/login', adminLoginLimiter, adminLogin);
router.post('/bootstrap', adminLoginLimiter, bootstrapAdmin);

router.get(
  '/users',
  requireAdmin,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('page must be at least 1'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
    validateRequest,
  ],
  getUsers
);

router.get(
  '/users/:userId',
  requireAdmin,
  [param('userId').isUUID().withMessage('valid userId is required'), validateRequest],
  getUserById
);

router.post(
  '/block/:userId',
  requireAdmin,
  [param('userId').isUUID().withMessage('valid userId is required'), validateRequest],
  blockUser
);

router.post(
  '/unblock/:userId',
  requireAdmin,
  [param('userId').isUUID().withMessage('valid userId is required'), validateRequest],
  unblockUser
);

module.exports = router;
