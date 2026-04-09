const express = require('express');
const { param } = require('express-validator');

const authMiddleware = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validationMiddleware');
const {
  saveSecurityQuestions,
  getSecurityQuestionChallenge,
  verifySecurityQuestions,
} = require('../controllers/securityQuestionController');

const router = express.Router();

router.use(authMiddleware);

router.post('/save', saveSecurityQuestions);
router.get(
  '/challenge/:nomineeId',
  [param('nomineeId').isUUID().withMessage('nomineeId must be a UUID'), validateRequest],
  getSecurityQuestionChallenge
);
router.post('/verify', verifySecurityQuestions);

module.exports = router;
