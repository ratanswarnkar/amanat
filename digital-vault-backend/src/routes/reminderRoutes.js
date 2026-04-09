const express = require('express');
const { param } = require('express-validator');

const authMiddleware = require('../middleware/authMiddleware');
const checkCaretakerAccess = require('../middleware/checkCaretakerAccess');
const validateRequest = require('../middleware/validationMiddleware');
const {
  getReminders,
  createReminder,
  completeReminder,
  registerDeviceToken,
  getNotificationHistory,
} = require('../controllers/reminderController');

const router = express.Router();

router.use(authMiddleware, checkCaretakerAccess);

router.get('/reminders', getReminders);
router.post('/reminders', createReminder);
router.post(
  '/reminders/:id/complete',
  [param('id').isUUID().withMessage('valid reminder id is required'), validateRequest],
  completeReminder
);
router.post('/notifications/device-token', registerDeviceToken);
router.get('/notifications/history', getNotificationHistory);

module.exports = router;
