const jwt = require('jsonwebtoken');
const { findActiveSessionById, findUserById } = require('../models/authModel');

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader || typeof authHeader !== 'string') {
    console.warn('[Auth Failure] Missing authorization header', {
      method: req.method,
      path: req.originalUrl,
    });
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!bearerMatch) {
    console.warn('[Auth Failure] Invalid bearer format', {
      method: req.method,
      path: req.originalUrl,
    });
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const token = String(bearerMatch[1] || '').trim();
  if (!token) {
    console.warn('[Auth Failure] Empty bearer token', {
      method: req.method,
      path: req.originalUrl,
    });
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('[Auth Failure] JWT secret missing in environment');
      return res.status(500).json({ success: false, message: 'JWT_SECRET is not configured' });
    }

    const decoded = jwt.verify(token, secret);
    const isAccessToken = !decoded.type || decoded.type === 'access';

    if (!isAccessToken) {
      console.warn('[Auth Failure] Invalid token type', {
        method: req.method,
        path: req.originalUrl,
      });
      return res.status(401).json({ success: false, message: 'Invalid token type' });
    }

    // Backward compatibility: older tokens may not have sid.
    if (decoded.sid) {
      const session = await findActiveSessionById(decoded.sid);
      if (!session) {
        console.warn('[Auth Failure] Revoked or expired session', {
          method: req.method,
          path: req.originalUrl,
        });
        return res.status(401).json({ success: false, message: 'Session expired or revoked' });
      }
      req.authSession = session;
    }

    const userId = decoded.userId || decoded.sub;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const user = await findUserById(userId);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (user.is_blocked) {
      console.warn('[Auth Failure] Blocked user access denied', {
        method: req.method,
        path: req.originalUrl,
        userId,
      });
      return res.status(403).json({ success: false, message: 'User account is blocked' });
    }

    req.currentUser = user;
    req.user = {
      ...decoded,
      role: user.role,
      email: user.email || decoded.email || null,
    };
    return next();
  } catch (error) {
    console.warn('[Auth Failure] Token verification failed', {
      method: req.method,
      path: req.originalUrl,
      reason: error.message,
    });
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

module.exports = authMiddleware;
