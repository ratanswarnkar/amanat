const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { initFirebaseAdmin } = require('../config/firebaseAdmin');
const { sendError, sendOk } = require('../utils/http');
const { generateOtp, sendOtpSms } = require('../services/otpService');
const { hasUserSecurityQuestions } = require('../models/securityQuestionModel');
const logger = require('../utils/logger');

const {
  createOtpCode,
  findLatestOtpCodeByPhone,
  incrementOtpAttempts,
  deleteOtpCodesByPhone,
  deleteExpiredOtpCodes,
  findUserByMobile,
  findUserByEmail,
  findUserById,
  getUserRoles,
  createUserWithMobile,
  setUserMobileVerified,
  updateUserPinHash,
  createSession,
  findActiveSessionByRefreshToken,
  rotateSessionRefreshToken,
  revokeSessionById,
  revokeAllSessionsForUser,
} = require('../models/authModel');

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES || 5);
const OTP_RESEND_SECONDS = Number(process.env.OTP_RESEND_SECONDS || 60);
const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '1h';
const REFRESH_TOKEN_DAYS = Number(process.env.JWT_REFRESH_TOKEN_DAYS || 30);
const OTP_VERIFIED_TOKEN_EXPIRES_MINUTES = Number(process.env.OTP_VERIFIED_TOKEN_EXPIRES_MINUTES || 10);

const isValidPhone = (phone) => /^\d{10}$/.test(phone || '');

const getPhoneFromRequest = (body = {}) => body.phone || body.mobile || '';
const getIdentifierFromRequest = (body = {}) => body.identifier || body.email || body.phone || body.mobile || '';

const normalizeIndianMobile = (phoneNumber = '') => phoneNumber.replace(/\D/g, '').slice(-10);
const normalizeDisplayName = (value = '') => {
  const normalized = String(value || '').trim();
  if (!normalized || normalized === 'User') {
    return '';
  }
  return normalized;
};

const getClientIp = (req) => {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || null;
};

const signAccessToken = ({ user, sessionId }) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const error = new Error('JWT_SECRET is missing');
    error.statusCode = 500;
    throw error;
  }

  if (process.env.NODE_ENV === 'production' && secret.length < 32) {
    const error = new Error('JWT_SECRET is too short. Use a strong random secret (32+ chars).');
    error.statusCode = 500;
    throw error;
  }

  return jwt.sign(
    {
      sub: user.id,
      userId: user.id,
      mobile: user.mobile,
      phone: user.mobile,
      role: user.role,
      sid: sessionId,
      type: 'access',
    },
    secret,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );
};

const signOtpVerifiedToken = ({ mobile }) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const error = new Error('JWT_SECRET is missing');
    error.statusCode = 500;
    throw error;
  }

  const normalizedMobile = normalizeIndianMobile(mobile);

  return jwt.sign(
    {
      mobile: normalizedMobile,
      phone: normalizedMobile,
      type: 'otp_verified',
      verifiedAt: new Date().toISOString(),
    },
    secret,
    { expiresIn: `${OTP_VERIFIED_TOKEN_EXPIRES_MINUTES}m` }
  );
};

const buildTokenPair = async ({ user, req, existingSessionId = null, rotateOnly = false }) => {
  const refreshToken = crypto.randomBytes(64).toString('hex');
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
  const userAgent = req.headers['user-agent'] || null;
  const ipAddress = getClientIp(req);

  let session;
  if (existingSessionId && rotateOnly) {
    session = await rotateSessionRefreshToken({
      sessionId: existingSessionId,
      refreshToken,
      expiresAt: refreshExpiresAt,
    });
  } else {
    session = await createSession({
      userId: user.id,
      refreshToken,
      userAgent,
      ipAddress,
      expiresAt: refreshExpiresAt,
    });
  }

  if (!session) {
    const error = new Error('Failed to create auth session');
    error.statusCode = 500;
    throw error;
  }

  const accessToken = signAccessToken({ user, sessionId: session.id });

  return {
    token: accessToken,
    refreshToken,
    sessionId: session.id,
  };
};

const ensureVerifiedUserByMobile = async (mobile) => {
  let user = await findUserByMobile(mobile);

  if (!user) {
    user = await createUserWithMobile({ id: uuidv4(), mobile });
    return user;
  }

  if (!user.is_mobile_verified) {
    await setUserMobileVerified(mobile);
    user = {
      ...user,
      is_mobile_verified: true,
    };
  }

  return user;
};

const buildClientUser = async (user) => {
  const hasSecurityQuestions = await hasUserSecurityQuestions(user.id);
  const fullName = normalizeDisplayName(user.full_name);

  return {
    id: user.id,
    name: fullName,
    full_name: fullName,
    phone: user.mobile,
    email: user.email || null,
    role: user.role,
    isBlocked: Boolean(user.is_blocked),
    hasSecurityQuestions,
  };
};

const logLoginRoles = (userId, roles) => {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  console.log('LOGIN USER:', userId);
  console.log('ROLES:', roles);
};

const sendOtp = async (req, res) => {
  try {
    console.log('AUTH LOGIN HIT');
    await deleteExpiredOtpCodes();

    const mobile = getPhoneFromRequest(req.body);

    if (!isValidPhone(mobile)) {
      return sendError(res, 400, 'Valid 10-digit mobile is required');
    }

    const latestOtp = await findLatestOtpCodeByPhone(mobile);

    if (latestOtp?.created_at) {
      const waitMs = OTP_RESEND_SECONDS * 1000 - (Date.now() - new Date(latestOtp.created_at).getTime());
      if (waitMs > 0) {
        const waitSeconds = Math.ceil(waitMs / 1000);
        return sendError(res, 429, `Please wait ${waitSeconds}s before requesting another OTP`);
      }
    }

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await createOtpCode({
      phone: mobile,
      otp: otpHash,
      expiresAt,
    });

    await sendOtpSms({ mobile, otp });

    return sendOk(res, {
      message: 'OTP sent successfully',
      expiresInSeconds: OTP_EXPIRY_MINUTES * 60,
    });
  } catch (error) {
    return sendError(res, error.statusCode || 500, error.message || 'Failed to send OTP');
  }
};

const resendOtp = async (req, res) => {
  return sendOtp(req, res);
};

const verifyOtp = async (req, res) => {
  try {
    console.log('AUTH LOGIN HIT');
    const mobile = getPhoneFromRequest(req.body);
    const otp = String(req.body?.otp || '').trim();

    if (!isValidPhone(mobile)) {
      return sendError(res, 400, 'Valid 10-digit mobile is required');
    }

    if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(otp)) {
      return sendError(res, 400, 'OTP must be exactly 6 digits');
    }

    const latestOtp = await findLatestOtpCodeByPhone(mobile);

    if (!latestOtp || !latestOtp.otp || !latestOtp.expires_at) {
      return sendError(res, 401, 'OTP not found. Please request a new OTP');
    }

    if (new Date(latestOtp.expires_at).getTime() <= Date.now()) {
      return sendError(res, 401, 'OTP expired. Please request a new OTP');
    }

    const isOtpValid = await bcrypt.compare(otp, latestOtp.otp);

    if (!isOtpValid) {
      await incrementOtpAttempts(latestOtp.id);
      return sendError(res, 401, 'Invalid OTP');
    }

    await deleteOtpCodesByPhone(mobile);

    const user = await ensureVerifiedUserByMobile(mobile);
    if (user.is_blocked) {
      return sendError(res, 403, 'User account is blocked');
    }
    const tokens = await buildTokenPair({ user, req });
    const roles = await getUserRoles(user.id);
    logLoginRoles(user.id, roles);

    return sendOk(res, {
      message: 'OTP verified successfully',
      token: tokens.token,
      refreshToken: tokens.refreshToken,
      otp_verified_token: signOtpVerifiedToken({ mobile }),
      hasPin: Boolean(user.pin_hash),
      user: await buildClientUser(user),
      roles,
    });
  } catch (error) {
    return sendError(res, error.statusCode || 500, error.message || 'Failed to verify OTP');
  }
};

const firebaseExchange = async (req, res) => {
  try {
    const { idToken, mobile } = req.body || {};

    if (!idToken || typeof idToken !== 'string') {
      return sendError(res, 400, 'idToken is required');
    }

    if (idToken.length > 6000) {
      return sendError(res, 400, 'idToken is invalid');
    }

    initFirebaseAdmin();
    const admin = require('firebase-admin');
    const decoded = await admin.auth().verifyIdToken(idToken);
    const tokenPhone = decoded.phone_number || decoded.phoneNumber || '';

    const resolvedMobile = normalizeIndianMobile(mobile || tokenPhone);
    if (!isValidPhone(resolvedMobile)) {
      return sendError(res, 400, 'Valid 10-digit phone number is required');
    }

    const user = await ensureVerifiedUserByMobile(resolvedMobile);
    if (user.is_blocked) {
      return sendError(res, 403, 'User account is blocked');
    }
    const tokens = await buildTokenPair({ user, req });
    const roles = await getUserRoles(user.id);
    logLoginRoles(user.id, roles);

    return sendOk(res, {
      message: 'Firebase phone verified',
      token: tokens.token,
      refreshToken: tokens.refreshToken,
      otp_verified_token: signOtpVerifiedToken({ mobile: resolvedMobile }),
      hasPin: Boolean(user.pin_hash),
      user: await buildClientUser(user),
      roles,
    });
  } catch (error) {
    const isFirebaseAuthError = String(error?.code || '').startsWith('auth/');
    return sendError(res, isFirebaseAuthError ? 401 : (error.statusCode || 500), error.message || 'Firebase exchange failed');
  }
};

const setPin = async (req, res) => {
  try {
    const mobileFromRequest = getPhoneFromRequest(req.body);
    const { pin } = req.body;
    const verifiedMobile = normalizeIndianMobile(req.otpVerified?.mobile || '');
    const requestedMobile = normalizeIndianMobile(mobileFromRequest);
    const mobile = verifiedMobile || requestedMobile;

    if (!isValidPhone(mobile)) {
      return sendError(res, 400, 'Valid phone number is required');
    }

    if (requestedMobile && requestedMobile !== mobile) {
      logger.warn('PIN setup rejected due to OTP token mismatch', {
        requestId: req.requestId,
      });
      return sendError(res, 403, 'OTP verification does not match this mobile number');
    }

    if (!/^\d{4}$/.test(pin || '')) {
      return sendError(res, 400, 'PIN must be exactly 4 digits');
    }

    const user = await findUserByMobile(mobile);

    if (!user) {
      return sendError(res, 404, 'User not found. Verify OTP first.');
    }

    if (!user.is_mobile_verified) {
      return sendError(res, 400, 'Mobile is not verified');
    }

    const pinHash = await bcrypt.hash(pin, 10);
    await updateUserPinHash({ mobile, pinHash });

    return sendOk(res, { message: 'PIN set successfully' });
  } catch (error) {
    return sendError(res, error.statusCode || 500, error.message || 'Failed to set PIN');
  }
};

const login = async (req, res) => {
  try {
    console.log('AUTH LOGIN HIT');
    const identifier = String(getIdentifierFromRequest(req.body) || '').trim();
    const passwordOrPin = String(req.body?.pin || req.body?.password || '').trim();

    if (!identifier) {
      return sendError(res, 400, 'phone, mobile, email, or identifier is required');
    }

    if (!passwordOrPin) {
      return sendError(res, 400, 'PIN is required');
    }

    if (!/^\d{4}$/.test(passwordOrPin)) {
      return sendError(res, 400, 'PIN must be exactly 4 digits');
    }

    const normalizedPhone = normalizeIndianMobile(identifier);
    const user = isValidPhone(normalizedPhone)
      ? await findUserByMobile(normalizedPhone)
      : await findUserByEmail(identifier);

    if (!user || !user.pin_hash) {
      return sendError(res, 401, 'PIN is not set for this account');
    }

    if (user.is_blocked) {
      return sendError(res, 403, 'User account is blocked');
    }

    const isPinValid = await bcrypt.compare(passwordOrPin, user.pin_hash);
    if (!isPinValid) {
      return sendError(res, 401, 'Invalid PIN');
    }

    if (!user.is_mobile_verified) {
      await setUserMobileVerified(user.mobile);
    }

    const tokens = await buildTokenPair({ user, req });
    const roles = await getUserRoles(user.id);
    logLoginRoles(user.id, roles);

    return sendOk(res, {
      message: 'Login successful',
      token: tokens.token,
      refreshToken: tokens.refreshToken,
      user: await buildClientUser(user),
      roles,
    });
  } catch (error) {
    return sendError(res, error.statusCode || 500, error.message || 'Login failed');
  }
};

const refresh = async (req, res) => {
  try {
    const refreshToken = String(req.body?.refreshToken || '').trim();

    if (!refreshToken) {
      return sendError(res, 400, 'refreshToken is required');
    }

    const session = await findActiveSessionByRefreshToken(refreshToken);

    if (!session) {
      return sendError(res, 401, 'Invalid or expired refresh token');
    }

    const user = await findUserById(session.user_id);

    if (!user) {
      await revokeSessionById(session.id);
      return sendError(res, 401, 'Session user not found');
    }

    if (user.is_blocked) {
      await revokeSessionById(session.id);
      return sendError(res, 403, 'User account is blocked');
    }

    const tokens = await buildTokenPair({
      user,
      req,
      existingSessionId: session.id,
      rotateOnly: true,
    });
    const roles = await getUserRoles(user.id);
    logLoginRoles(user.id, roles);

    return sendOk(res, {
      message: 'Token refreshed successfully',
      token: tokens.token,
      refreshToken: tokens.refreshToken,
      user: await buildClientUser(user),
      roles,
    });
  } catch (error) {
    return sendError(res, error.statusCode || 500, error.message || 'Failed to refresh token');
  }
};

const logout = async (req, res) => {
  try {
    const refreshToken = String(req.body?.refreshToken || '').trim();

    if (refreshToken) {
      const session = await findActiveSessionByRefreshToken(refreshToken);
      if (session) {
        await revokeSessionById(session.id);
      }
    }

    return sendOk(res, { message: 'Logged out successfully' });
  } catch (error) {
    return sendError(res, error.statusCode || 500, error.message || 'Failed to logout');
  }
};

const logoutAll = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.sub;

    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    await revokeAllSessionsForUser(userId);

    return sendOk(res, { message: 'All sessions logged out successfully' });
  } catch (error) {
    return sendError(res, error.statusCode || 500, error.message || 'Failed to logout all sessions');
  }
};

const verifyUserPin = async (_req, res) => sendOk(res, {
  success: true,
  message: 'PIN verified successfully',
});

module.exports = {
  sendOtp,
  verifyOtp,
  resendOtp,
  firebaseExchange,
  setPin,
  login,
  refresh,
  logout,
  logoutAll,
  verifyUserPin,
};
