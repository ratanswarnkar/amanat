const { sendError, sendOk } = require('../utils/http');
const { generateOtp, sendOtpSms } = require('../services/otpService');
const {
  setUserEmergencyActive,
  createEmergencyTrigger,
  getActiveEmergencyTriggerByUserId,
  getVerifiedNomineesByUserId,
  getActiveGrantsByUserId,
  createOrReuseVaultAccessGrant,
} = require('../models/emergencyModel');

const DEFAULT_ACCESS_HOURS = Number(process.env.EMERGENCY_ACCESS_HOURS || 24);

const getUserId = (req) => req.user?.userId || req.user?.sub;

const normalizeIndianMobile = (value = '') => String(value).replace(/\D/g, '').slice(-10);

const logEmergencyAction = ({ req, action, payload }) => {
  console.info('[Emergency Action]', {
    requestId: req.requestId,
    action,
    ...payload,
    at: new Date().toISOString(),
  });
};

const triggerEmergency = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    const triggerReason = String(req.body?.trigger_reason || 'manual_trigger').trim() || 'manual_trigger';

    const trigger = await createEmergencyTrigger({ userId, triggerReason });
    const flagged = await setUserEmergencyActive({ userId, emergencyActive: true });

    const verifiedNominees = await getVerifiedNomineesByUserId(userId);

    const notified = [];
    const notificationErrors = [];

    for (const nominee of verifiedNominees) {
      const smsMobile = normalizeIndianMobile(nominee.phone);
      if (!/^\d{10}$/.test(smsMobile)) {
        notificationErrors.push({ nominee_id: nominee.id, reason: 'invalid_phone' });
        continue;
      }

      try {
        await sendOtpSms({ mobile: smsMobile, otp: generateOtp() });
        notified.push({ nominee_id: nominee.id, phone: smsMobile, name: nominee.name });
      } catch (error) {
        notificationErrors.push({
          nominee_id: nominee.id,
          phone: smsMobile,
          reason: error.message || 'sms_failed',
        });
      }
    }

    logEmergencyAction({
      req,
      action: 'trigger',
      payload: {
        userId,
        triggerId: trigger.id,
        triggerReason,
        verifiedNomineeCount: verifiedNominees.length,
        notifiedCount: notified.length,
        notificationErrorCount: notificationErrors.length,
        userEmergencyFlagUpdated: flagged,
      },
    });

    return sendOk(
      res,
      {
        message: 'Emergency triggered successfully',
        emergency_active: true,
        trigger,
        verified_nominees: verifiedNominees.length,
        notified_nominees: notified,
        notification_errors: notificationErrors,
      },
      201
    );
  } catch (error) {
    return sendError(res, 500, error.message || 'Failed to trigger emergency');
  }
};

const getEmergencyStatus = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    const activeTrigger = await getActiveEmergencyTriggerByUserId(userId);
    const activeGrants = await getActiveGrantsByUserId(userId);

    logEmergencyAction({
      req,
      action: 'status',
      payload: {
        userId,
        emergencyActive: Boolean(activeTrigger),
        activeGrantCount: activeGrants.length,
      },
    });

    return sendOk(res, {
      message: 'Emergency status fetched successfully',
      emergency_active: Boolean(activeTrigger),
      active_trigger: activeTrigger,
      active_grants: activeGrants,
    });
  } catch (error) {
    return sendError(res, 500, error.message || 'Failed to fetch emergency status');
  }
};

const grantEmergencyVaultAccess = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    const requestedHours = Number(req.body?.expires_in_hours);
    const accessHours = Number.isFinite(requestedHours) && requestedHours > 0
      ? requestedHours
      : DEFAULT_ACCESS_HOURS;

    const activeTrigger = await getActiveEmergencyTriggerByUserId(userId);
    if (!activeTrigger) {
      return sendError(res, 400, 'No active emergency trigger found. Trigger emergency first.');
    }

    const verifiedNominees = await getVerifiedNomineesByUserId(userId);
    if (verifiedNominees.length === 0) {
      return sendError(res, 400, 'No verified nominees found for access grant');
    }

    const expiresAt = new Date(Date.now() + accessHours * 60 * 60 * 1000);

    const grants = [];
    for (const nominee of verifiedNominees) {
      const grant = await createOrReuseVaultAccessGrant({
        userId,
        nomineeId: nominee.id,
        triggerId: activeTrigger.id,
        expiresAt,
      });

      grants.push({
        ...grant,
        nominee_name: nominee.name,
        nominee_phone: nominee.phone,
        access_token: grant.token,
        access_scope: grant.access_scope || 'read_only',
      });
    }

    logEmergencyAction({
      req,
      action: 'grant_access',
      payload: {
        userId,
        triggerId: activeTrigger.id,
        accessHours,
        grantedCount: grants.length,
      },
    });

    return sendOk(res, {
      message: 'Vault access granted to verified nominees',
      emergency_active: true,
      trigger_id: activeTrigger.id,
      expires_at: expiresAt,
      grants,
    });
  } catch (error) {
    return sendError(res, 500, error.message || 'Failed to grant emergency vault access');
  }
};

module.exports = {
  triggerEmergency,
  getEmergencyStatus,
  grantEmergencyVaultAccess,
};
