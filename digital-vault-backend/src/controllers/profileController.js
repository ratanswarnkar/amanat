const { findProfileByUserId, updateProfileByUserId } = require('../models/profileModel');
const { sendError, sendOk } = require('../utils/http');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getUserId = (req) => req.user?.userId || req.user?.sub;

const getProfile = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    const profile = await findProfileByUserId(userId);
    if (!profile) {
      return sendError(res, 404, 'Profile not found');
    }

    return sendOk(res, {
      message: 'Profile fetched successfully',
      profile,
    });
  } catch (error) {
    return sendError(res, 500, error.message || 'Failed to fetch profile');
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = getUserId(req);
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const phone = req.body?.phone === undefined ? undefined : String(req.body?.phone || '').trim();

    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    if (!name) {
      return sendError(res, 400, 'name is required');
    }

    if (email && !EMAIL_REGEX.test(email)) {
      return sendError(res, 400, 'Valid email is required');
    }

    const currentProfile = await findProfileByUserId(userId);
    if (!currentProfile) {
      return sendError(res, 404, 'Profile not found');
    }

    if (phone !== undefined && phone !== currentProfile.phone) {
      return sendError(res, 400, 'phone cannot be changed from the profile screen');
    }

    const profile = await updateProfileByUserId({
      userId,
      name,
      email,
    });

    return sendOk(res, {
      message: 'Profile updated successfully',
      profile,
    });
  } catch (error) {
    if (error?.code === '23505') {
      return sendError(res, 409, 'Email is already in use');
    }

    return sendError(res, 500, error.message || 'Failed to update profile');
  }
};

module.exports = {
  getProfile,
  updateProfile,
};
