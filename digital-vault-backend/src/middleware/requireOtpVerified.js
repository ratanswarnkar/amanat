const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const readOtpVerifiedToken = (req) => {
  const headerValue = req.headers['x-otp-verified-token'];
  if (typeof headerValue === 'string' && headerValue.trim()) {
    return headerValue.trim();
  }

  const bodyValue = req.body?.otp_verified_token;
  if (typeof bodyValue === 'string' && bodyValue.trim()) {
    return bodyValue.trim();
  }

  return '';
};

const requireOtpVerified = (req, res, next) => {
  const token = readOtpVerifiedToken(req);
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'OTP verification is required before setting PIN',
    });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    logger.error('JWT_SECRET missing for OTP verification middleware', {
      requestId: req.requestId,
    });
    return res.status(500).json({
      success: false,
      message: 'OTP verification is temporarily unavailable',
    });
  }

  try {
    const decoded = jwt.verify(token, secret);
    if (decoded?.type !== 'otp_verified' || !decoded?.mobile) {
      return res.status(401).json({
        success: false,
        message: 'Invalid OTP verification token',
      });
    }

    req.otpVerified = {
      mobile: String(decoded.mobile || '').trim(),
      verifiedAt: decoded.verifiedAt || null,
    };

    return next();
  } catch (error) {
    logger.warn('OTP verification token rejected', {
      requestId: req.requestId,
      reason: error.message,
    });
    return res.status(401).json({
      success: false,
      message: 'OTP verification token expired or invalid',
    });
  }
};

module.exports = requireOtpVerified;
