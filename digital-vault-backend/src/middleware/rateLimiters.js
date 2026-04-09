const rateLimit = require('express-rate-limit');

const normalizePhoneForKey = (req) => {
  const rawPhone = req.body?.phone || req.body?.mobile || req.query?.phone || req.query?.mobile || '';
  return String(rawPhone || '').replace(/\D/g, '').slice(-10) || 'no-phone';
};

const getRequestIp = (req) => req.ip || req.socket?.remoteAddress || 'unknown-ip';

const buildLimiter = ({ windowMs, max, message, keyGenerator }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message },
    keyGenerator,
  });

// Keep auth endpoints protected. Firebase itself throttles OTP, but exchange/login can be abused.
const authExchangeLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many requests. Please try again in a minute.',
});

const authLoginLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many login attempts. Please try again in a minute.',
  keyGenerator: (req) => `${getRequestIp(req)}:${normalizePhoneForKey(req)}`,
});

const authPinLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many requests. Please try again in a minute.',
  keyGenerator: (req) => `${getRequestIp(req)}:${normalizePhoneForKey(req)}`,
});

const authSendOtpLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many OTP requests. Please try again in a minute.',
  keyGenerator: (req) => `${getRequestIp(req)}:${normalizePhoneForKey(req)}`,
});

const adminLoginLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many admin login attempts. Please try again in a minute.',
  keyGenerator: (req) => {
    const identifier = String(req.body?.identifier || req.body?.email || req.body?.phone || req.body?.mobile || '').trim().toLowerCase();
    return `${getRequestIp(req)}:${identifier || 'no-identifier'}`;
  },
});

const nomineeAccessLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 25,
  message: 'Too many nominee access attempts. Please try again later.',
});

const healthRecordFileLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many health record file requests. Please try again in a minute.',
  keyGenerator: (req) => {
    const userId = req.user?.userId || req.user?.sub;
    return userId ? `user:${userId}` : `ip:${getRequestIp(req)}`;
  },
});

module.exports = {
  authExchangeLimiter,
  authLoginLimiter,
  authPinLimiter,
  authSendOtpLimiter,
  adminLoginLimiter,
  nomineeAccessLimiter,
  healthRecordFileLimiter,
};
