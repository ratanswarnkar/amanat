const express = require('express');
const {
  sendOtp,
  verifyOtp,
  resendOtp,
  setPin,
  login,
  refresh,
  logout,
  logoutAll,
  verifyUserPin,
} = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const verifyPin = require('../middleware/verifyPin');
const requireOtpVerified = require('../middleware/requireOtpVerified');
const {
  authExchangeLimiter,
  authLoginLimiter,
  authPinLimiter,
  authSendOtpLimiter,
} = require('../middleware/rateLimiters');

const router = express.Router();

router.post('/send-otp', authSendOtpLimiter, sendOtp);
router.post('/verify-otp', authSendOtpLimiter, verifyOtp);
router.post('/resend-otp', authSendOtpLimiter, resendOtp);
router.post('/set-pin', authPinLimiter, requireOtpVerified, setPin);
router.post('/login', authLoginLimiter, login);
router.post('/verify-pin', authPinLimiter, authMiddleware, verifyPin, verifyUserPin);
router.post('/refresh', authExchangeLimiter, refresh);
router.post('/logout', authExchangeLimiter, logout);
router.post('/logout-all', authExchangeLimiter, authMiddleware, logoutAll);

router.get('/me', authMiddleware, (req, res) => {
  res.status(200).json({
    message: 'Authorized',
    user: req.user,
  });
});

module.exports = router;
