const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const {
  findAdminByIdentifier,
  createSession,
  listUsersPaginated,
  findUserById,
  updateUserBlockedState,
  revokeAllSessionsForUser,
} = require('../models/authModel');
const { isBlockedDefaultAdminIdentifier } = require('../services/insecureAdminRemediationService');
const { sendError, sendOk } = require('../utils/http');

const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '1h';
const REFRESH_TOKEN_DAYS = Number(process.env.JWT_REFRESH_TOKEN_DAYS || 30);

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

  return jwt.sign(
    {
      sub: user.id,
      userId: user.id,
      mobile: user.mobile,
      phone: user.mobile,
      email: user.email || null,
      role: user.role,
      sid: sessionId,
      type: 'access',
    },
    secret,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );
};

const buildTokenPair = async ({ user, req }) => {
  const refreshToken = crypto.randomBytes(64).toString('hex');
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

  const session = await createSession({
    userId: user.id,
    refreshToken,
    userAgent: req.headers['user-agent'] || null,
    ipAddress: getClientIp(req),
    expiresAt: refreshExpiresAt,
  });

  return {
    token: signAccessToken({ user, sessionId: session.id }),
    refreshToken,
  };
};

const resolveDisplayName = (user) => {
  const fullName = String(user?.full_name || user?.fullName || user?.name || '').trim();
  if (fullName) {
    return fullName;
  }

  const firstName = String(user?.first_name || '').trim();
  const lastName = String(user?.last_name || '').trim();
  const combined = `${firstName} ${lastName}`.trim();
  return combined || 'Unnamed User';
};

const toAdminClientUser = (user) => ({
  id: user.id,
  name: resolveDisplayName(user),
  full_name: resolveDisplayName(user),
  mobile: user.mobile || null,
  email: user.email || null,
  role: user.role,
  is_blocked: Boolean(user.is_blocked),
  is_active: user.is_active,
  created_at: user.created_at,
  updated_at: user.updated_at,
  last_login_at: user.last_login_at || null,
  emergency_status: user.emergency_status || null,
});

const adminLogin = async (req, res) => {
  try {
    const identifier = String(req.body?.identifier || req.body?.email || req.body?.phone || req.body?.mobile || '').trim();
    const password = String(req.body?.password || req.body?.pin || '').trim();

    if (!identifier) {
      return sendError(res, 400, 'email, phone, mobile, or identifier is required');
    }

    if (!password) {
      return sendError(res, 400, 'password or pin is required');
    }

    if (isBlockedDefaultAdminIdentifier(identifier)) {
      return sendError(res, 401, 'Invalid admin credentials');
    }

    const adminUser = await findAdminByIdentifier(identifier);
    if (!adminUser || !adminUser.pin_hash) {
      return sendError(res, 401, 'Invalid admin credentials');
    }

    if (adminUser.is_blocked) {
      return sendError(res, 403, 'Admin account is blocked');
    }

    const isValidPassword = await bcrypt.compare(password, adminUser.pin_hash);
    if (!isValidPassword) {
      return sendError(res, 401, 'Invalid admin credentials');
    }

    const tokens = await buildTokenPair({ user: adminUser, req });

    return sendOk(res, {
      message: 'Admin login successful',
      token: tokens.token,
      refreshToken: tokens.refreshToken,
      user: toAdminClientUser(adminUser),
    });
  } catch (error) {
    return sendError(res, error.statusCode || 500, error.message || 'Admin login failed');
  }
};

const getUsers = async (req, res) => {
  try {
    const page = Number(req.query?.page || 1);
    const limit = Number(req.query?.limit || 20);
    const result = await listUsersPaginated({ page, limit });

    return sendOk(res, {
      message: 'Users fetched successfully',
      users: result.users.map(toAdminClientUser),
      pagination: result.pagination,
    });
  } catch (error) {
    return sendError(res, 500, error.message || 'Failed to fetch users');
  }
};

const getUserById = async (req, res) => {
  try {
    const userId = String(req.params?.userId || '').trim();
    if (!userId) {
      return sendError(res, 400, 'userId is required');
    }

    const user = await findUserById(userId);
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    return sendOk(res, {
      message: 'User fetched successfully',
      user: toAdminClientUser(user),
    });
  } catch (error) {
    return sendError(res, 500, error.message || 'Failed to fetch user');
  }
};

const blockUser = async (req, res) => {
  try {
    const targetUserId = String(req.params?.userId || '').trim();
    const actorUserId = req.user?.userId || req.user?.sub;

    if (!targetUserId) {
      return sendError(res, 400, 'userId is required');
    }

    if (actorUserId && actorUserId === targetUserId) {
      return sendError(res, 400, 'Admin cannot block their own account');
    }

    const updatedUser = await updateUserBlockedState({
      userId: targetUserId,
      isBlocked: true,
    });

    if (!updatedUser) {
      return sendError(res, 404, 'User not found');
    }

    await revokeAllSessionsForUser(targetUserId);

    return sendOk(res, {
      message: 'User blocked successfully',
      user: toAdminClientUser(updatedUser),
    });
  } catch (error) {
    return sendError(res, 500, error.message || 'Failed to block user');
  }
};

const unblockUser = async (req, res) => {
  try {
    const targetUserId = String(req.params?.userId || '').trim();

    if (!targetUserId) {
      return sendError(res, 400, 'userId is required');
    }

    const updatedUser = await updateUserBlockedState({
      userId: targetUserId,
      isBlocked: false,
    });

    if (!updatedUser) {
      return sendError(res, 404, 'User not found');
    }

    return sendOk(res, {
      message: 'User unblocked successfully',
      user: toAdminClientUser(updatedUser),
    });
  } catch (error) {
    return sendError(res, 500, error.message || 'Failed to unblock user');
  }
};

module.exports = {
  adminLogin,
  getUsers,
  getUserById,
  blockUser,
  unblockUser,
};
