const express = require('express');

const authMiddleware = require('../middleware/authMiddleware');
const { nomineeAccessLimiter } = require('../middleware/rateLimiters');
const {
  sendNomineeAccessOtp,
  verifyNomineeAccessOtp,
  loadNomineeAccessChallenge,
  verifyNomineeSecurityAnswers,
  getNomineeAccessStatus,
  getNomineeAccessFiles,
} = require('../controllers/nomineeAccessController');

const router = express.Router();

router.post('/send-otp', nomineeAccessLimiter, sendNomineeAccessOtp);
router.post('/verify-otp', nomineeAccessLimiter, verifyNomineeAccessOtp);
router.post('/challenge', nomineeAccessLimiter, loadNomineeAccessChallenge);
router.post('/verify-security', nomineeAccessLimiter, verifyNomineeSecurityAnswers);
router.get('/status', authMiddleware, getNomineeAccessStatus);
router.get('/files', authMiddleware, getNomineeAccessFiles);

module.exports = router;
