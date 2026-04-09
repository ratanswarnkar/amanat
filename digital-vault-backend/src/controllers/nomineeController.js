const bcrypt = require('bcrypt');

const { sendError, sendOk } = require('../utils/http');
const { generateOtp, sendOtpSms } = require('../services/otpService');
const logger = require('../utils/logger');
const {
  createNominee,
  getNomineesByUserId,
  getNomineeByIdForUser,
  deleteNomineeByIdForUser,
  getLatestVerificationByNominee,
  createOrUpdateNomineeVerificationOtp,
  markNomineeVerificationOtpVerified,
  markNomineeVerificationApproved,
  markNomineeApproved,
  incrementNomineeVerificationOtpAttempts,
} = require('../models/nomineeModel');

const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES || 5);

const getUserId = (req) => req.user?.userId || req.user?.sub;

const normalizeIndianMobile = (value = '') => String(value).replace(/\D/g, '').slice(-10);

const createNomineeEntry = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    const name = String(req.body?.name || '').trim();
    const phone = String(req.body?.phone || '').trim();
    const relationship = String(req.body?.relationship || '').trim();

    const nominee = await createNominee({ userId, name, phone, relationship });

    return sendOk(
      res,
      {
        message: 'Nominee created successfully',
        nominee,
      },
      201
    );
  } catch (error) {
    return sendError(res, 500, error.message || 'Failed to create nominee');
  }
};

const listNominees = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    const nominees = await getNomineesByUserId(userId);

    return sendOk(res, {
      message: 'Nominees fetched successfully',
      nominees,
    });
  } catch (error) {
    return sendError(res, 500, error.message || 'Failed to fetch nominees');
  }
};

const deleteNominee = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    const nomineeId = String(req.params?.id || '').trim();

    const deleted = await deleteNomineeByIdForUser({ nomineeId, userId });

    if (!deleted) {
      return sendError(res, 404, 'Nominee not found');
    }

    return sendOk(res, {
      message: 'Nominee deleted successfully',
      nominee: deleted,
    });
  } catch (error) {
    return sendError(res, 500, error.message || 'Failed to delete nominee');
  }
};

const sendNomineeVerification = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    const nomineeId = String(req.body?.nominee_id || '').trim();

    const nominee = await getNomineeByIdForUser({ nomineeId, userId });
    if (!nominee) {
      return sendError(res, 404, 'Nominee not found');
    }

    const smsMobile = normalizeIndianMobile(nominee.phone);
    if (!/^\d{10}$/.test(smsMobile)) {
      return sendError(res, 400, 'Nominee phone must be a valid 10-digit mobile number');
    }

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await createOrUpdateNomineeVerificationOtp({
      nomineeId,
      userId,
      otpHash,
      expiresAt,
      sentTo: smsMobile,
    });

    await sendOtpSms({ mobile: smsMobile, otp });

    return sendOk(res, {
      message: 'Verification OTP sent to nominee',
      nominee_id: nomineeId,
      expires_in_seconds: OTP_EXPIRY_MINUTES * 60,
    });
  } catch (error) {
    logger.error('Failed to send nominee verification OTP', {
      requestId: req.requestId,
      message: error.message,
    });
    return sendError(res, 500, error.message || 'Failed to send nominee verification OTP');
  }
};

const verifyNomineeOtp = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    const nomineeId = String(req.body?.nominee_id || '').trim();
    const otp = String(req.body?.otp || '').trim();

    const nominee = await getNomineeByIdForUser({ nomineeId, userId });
    if (!nominee) {
      return sendError(res, 404, 'Nominee not found');
    }

    const verification = await getLatestVerificationByNominee({ nomineeId, userId });
    if (!verification) {
      return sendError(res, 400, 'No verification request found. Send verification OTP first.');
    }

    const payload = verification.security_answers_json || {};
    const otpHash = payload.otp_hash;
    const otpExpiresAt = payload.otp_expires_at;

    if (!otpHash || !otpExpiresAt) {
      return sendError(res, 400, 'Verification OTP is missing. Send verification OTP first.');
    }

    if (new Date(otpExpiresAt).getTime() <= Date.now()) {
      return sendError(res, 401, 'Verification OTP expired. Send a new OTP.');
    }

    const isValidOtp = await bcrypt.compare(otp, otpHash);
    if (!isValidOtp) {
      await incrementNomineeVerificationOtpAttempts({
        verificationId: verification.id,
        userId,
      });
      return sendError(res, 401, 'Invalid verification OTP');
    }

    await markNomineeVerificationOtpVerified({
      verificationId: verification.id,
      userId,
    });

    const approvedVerification = await markNomineeVerificationApproved({
      verificationId: verification.id,
      userId,
    });

    await markNomineeApproved({
      nomineeId,
      userId,
    });

    logger.info('Nominee approved after OTP verification', {
      requestId: req.requestId,
      nomineeId,
      verificationId: verification.id,
      userId,
    });

    return sendOk(res, {
      message: 'OTP verified successfully. Nominee approved.',
      nominee_id: nomineeId,
      verification: {
        id: approvedVerification?.id,
        status: approvedVerification?.status,
        verified_at: approvedVerification?.verified_at || null,
        otp_verified_at: approvedVerification?.security_answers_json?.otp_verified_at || null,
      },
    });
  } catch (error) {
    return sendError(res, 500, error.message || 'Failed to verify nominee OTP');
  }
};

module.exports = {
  createNomineeEntry,
  listNominees,
  deleteNominee,
  sendNomineeVerification,
  verifyNomineeOtp,
};
