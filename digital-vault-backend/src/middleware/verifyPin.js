const bcrypt = require('bcrypt');

const { findUserById } = require('../models/authModel');
const logger = require('../utils/logger');

const readPinFromRequest = (req) => {
  const headerPin = req.headers['x-user-pin'];
  if (typeof headerPin === 'string' && headerPin.trim()) {
    return headerPin.trim();
  }

  const bodyPin = req.body?.pin;
  if (typeof bodyPin === 'string' && bodyPin.trim()) {
    return bodyPin.trim();
  }

  return '';
};

const verifyPin = async (req, res, next) => {
  try {
    const userId = req.user?.userId || req.user?.sub;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const pin = readPinFromRequest(req);
    if (!pin) {
      return res.status(401).json({
        success: false,
        message: 'PIN verification is required',
      });
    }

    const user = await findUserById(userId);
    if (!user?.pin_hash) {
      return res.status(401).json({
        success: false,
        message: 'PIN is not set for this account',
      });
    }

    const isValidPin = await bcrypt.compare(pin, user.pin_hash);
    if (!isValidPin) {
      logger.warn('PIN verification failed', {
        requestId: req.requestId,
        userId,
        path: req.originalUrl,
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid PIN',
      });
    }

    return next();
  } catch (error) {
    logger.error('PIN verification error', {
      requestId: req.requestId,
      message: error.message,
    });
    return res.status(500).json({
      success: false,
      message: 'Failed to verify PIN',
    });
  }
};

module.exports = verifyPin;
