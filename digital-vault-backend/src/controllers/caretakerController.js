const bcrypt = require('bcrypt');

const { sendError, sendOk } = require('../utils/http');
const { findUserByMobile } = require('../models/authModel');
const { generateOtp, sendOtpSms } = require('../services/otpService');
const {
  createOrUpdateCaretakerLink,
  getCaretakersByUserId,
  getCaretakerByIdForUser,
  deleteCaretakerById,
  incrementCaretakerOtpAttempts,
  markCaretakerApproved,
} = require('../models/caretakerModel');

const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES || 5);
const normalizeIndianMobile = (value = '') => String(value || '').replace(/\D/g, '').slice(-10);
const getUserId = (req) => req.user?.userId || req.user?.sub;

const createCaretakerEntry = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    const phone = normalizeIndianMobile(req.body?.phone || '');
    const relationship = String(req.body?.relationship || 'caretaker').trim();
    const accessLevel = String(req.body?.access_level || 'view').trim();

    if (!/^\d{10}$/.test(phone)) {
      return sendError(res, 400, 'Valid 10-digit caretaker phone is required');
    }

    const linkedUser = await findUserByMobile(phone);
    if (!linkedUser) {
      return sendError(res, 404, 'No registered user found for this phone number');
    }

    if (linkedUser.id === userId) {
      return sendError(res, 400, 'You cannot add yourself as caretaker');
    }

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    const caretaker = await createOrUpdateCaretakerLink({
      userId,
      caretakerUserId: linkedUser.id,
      name: linkedUser.full_name || req.body?.name || 'Caretaker',
      phone,
      relationship,
      accessLevel,
      otpHash,
      otpExpiresAt: expiresAt,
    });

    await sendOtpSms({ mobile: phone, otp });

    return sendOk(res, {
      message: 'Caretaker added successfully. OTP sent for verification.',
      caretaker,
      expires_in_seconds: OTP_EXPIRY_MINUTES * 60,
    }, 201);
  } catch (error) {
    return sendError(res, 500, error.message || 'Failed to add caretaker');
  }
};

const verifyCaretaker = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    const caretakerId = String(req.body?.caretaker_id || '').trim();
    const otp = String(req.body?.otp || '').trim();

    const caretaker = await getCaretakerByIdForUser({ caretakerId, userId });
    if (!caretaker) {
      return sendError(res, 404, 'Caretaker not found');
    }

    if (!caretaker.otp_hash || !caretaker.otp_expires_at) {
      return sendError(res, 400, 'No caretaker verification request found. Add caretaker first.');
    }

    if (new Date(caretaker.otp_expires_at).getTime() <= Date.now()) {
      return sendError(res, 401, 'Caretaker OTP expired. Add or resend caretaker verification again.');
    }

    const isValidOtp = await bcrypt.compare(otp, caretaker.otp_hash);
    if (!isValidOtp) {
      await incrementCaretakerOtpAttempts({ caretakerId, userId });
      return sendError(res, 401, 'Invalid caretaker OTP');
    }

    const approvedCaretaker = await markCaretakerApproved({ caretakerId, userId });

    return sendOk(res, {
      message: 'Caretaker verified successfully',
      caretaker: approvedCaretaker,
    });
  } catch (error) {
    return sendError(res, 500, error.message || 'Failed to verify caretaker');
  }
};

const getCaretakers = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    const caretakers = await getCaretakersByUserId(userId);
    return sendOk(res, {
      message: 'Caretakers fetched successfully',
      caretakers,
    });
  } catch (error) {
    return sendError(res, 500, error.message || 'Failed to fetch caretakers');
  }
};

const deleteCaretaker = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    const deleted = await deleteCaretakerById({
      caretakerId: req.params.id,
      userId,
    });

    if (!deleted) {
      return sendError(res, 404, 'Caretaker not found');
    }

    return sendOk(res, { message: 'Caretaker deleted successfully' });
  } catch (error) {
    return sendError(res, 500, error.message || 'Failed to delete caretaker');
  }
};

module.exports = {
  createCaretakerEntry,
  verifyCaretaker,
  getCaretakers,
  deleteCaretaker,
};
