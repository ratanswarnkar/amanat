const { sendError, sendOk } = require('../utils/http');
const {
  setUserActiveState,
  getOrCreateUserLifeSettings,
  updateUserLifeSettings,
  createLifeConfirmation,
  upsertLifeCheckConfirmedForToday,
  upsertLifeCheckMissedForToday,
  getLifeStatusSummary,
  createLifeAuditLog,
  getLifeAuditLogsByUserId,
} = require('../models/lifeModel');
const {
  setUserEmergencyActive,
  getActiveEmergencyTriggerByUserId,
  createEmergencyTrigger,
  resolveActiveEmergencyTriggersByUserId,
} = require('../models/emergencyModel');

const LIFE_THRESHOLD_DAYS = Number(process.env.LIFE_CONFIRMATION_MAX_DAYS || 7);
const DEFAULT_ADMIN_OVERRIDE_HOURS = Number(process.env.LIFE_ADMIN_OVERRIDE_HOURS || 24);

const getUserId = (req) => req.user?.userId || req.user?.sub;
const isAdmin = (req) => req.user?.role === 'admin';

const logLifeAction = ({ req, action, payload }) => {
  console.info('[Life Action]', {
    requestId: req.requestId,
    action,
    ...payload,
    at: new Date().toISOString(),
  });
};

const confirmLife = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    const source = String(req.body?.source || 'mobile_app').trim() || 'mobile_app';

    const confirmation = await createLifeConfirmation({
      userId,
      source,
      status: 'confirmed_alive',
    });

    const lifeEvent = await upsertLifeCheckConfirmedForToday({ userId });
    const activeFlagUpdated = await setUserActiveState({ userId, isActive: true });
    const emergencyFlagUpdated = await setUserEmergencyActive({ userId, emergencyActive: false });
    const resolvedTriggers = await resolveActiveEmergencyTriggersByUserId({ userId });
    const settings = await updateUserLifeSettings({
      userId,
      clearAdminOverride: true,
    });
    await createLifeAuditLog({
      targetUserId: userId,
      actorUserId: userId,
      actorType: 'user',
      action: 'life_confirmed',
      details: {
        source,
        threshold_days: settings?.confirmation_interval_days || LIFE_THRESHOLD_DAYS,
        resolved_trigger_count: resolvedTriggers.length,
      },
    });

    logLifeAction({
      req,
      action: 'confirm',
      payload: {
        userId,
        confirmationId: confirmation.id,
        source,
        activeFlagUpdated,
        emergencyFlagUpdated,
        resolvedTriggerCount: resolvedTriggers.length,
      },
    });

    return sendOk(res, {
      message: 'Life confirmation recorded successfully',
      confirmation,
      life_check_event: lifeEvent,
      threshold_days: settings?.confirmation_interval_days || LIFE_THRESHOLD_DAYS,
    });
  } catch (error) {
    return sendError(res, 500, error.message || 'Failed to confirm life status');
  }
};

const updateLifeSettings = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    const confirmationIntervalDays = Number(req.body?.confirmation_interval_days);
    if (!Number.isInteger(confirmationIntervalDays) || confirmationIntervalDays < 1 || confirmationIntervalDays > 365) {
      return sendError(res, 400, 'confirmation_interval_days must be between 1 and 365');
    }

    const settings = await updateUserLifeSettings({
      userId,
      confirmationIntervalDays,
    });

    await createLifeAuditLog({
      targetUserId: userId,
      actorUserId: userId,
      actorType: 'user',
      action: 'life_settings_updated',
      details: {
        confirmation_interval_days: confirmationIntervalDays,
      },
    });

    return sendOk(res, {
      message: 'Life confirmation settings updated successfully',
      settings,
    });
  } catch (error) {
    return sendError(res, 500, error.message || 'Failed to update life settings');
  }
};

const getLifeStatus = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    const statusSummary = await getLifeStatusSummary({
      userId,
      thresholdDays: LIFE_THRESHOLD_DAYS,
    });
    let activeTrigger = await getActiveEmergencyTriggerByUserId(userId);
    const auditLogs = await getLifeAuditLogsByUserId(userId, 20);

    logLifeAction({
      req,
      action: 'status',
      payload: {
        userId,
        daysSinceLastConfirmation: statusSummary.daysSinceLastConfirmation,
        thresholdDays: LIFE_THRESHOLD_DAYS,
        isInactive: statusSummary.isInactive,
        emergencyTriggered: false,
      },
    });

    return sendOk(res, {
      message: 'Life status fetched successfully',
      threshold_days: statusSummary.thresholdDays,
      last_confirmation_at: statusSummary.lastConfirmation?.confirmed_at || null,
      days_since_last_confirmation: statusSummary.daysSinceLastConfirmation,
      next_confirmation_due_at: statusSummary.nextConfirmationDueAt || null,
      inactive: statusSummary.isInactive,
      override_active: statusSummary.overrideActive,
      override_state: statusSummary.overrideState,
      emergency_active: Boolean(activeTrigger),
      emergency_triggered_now: false,
      emergency_trigger: activeTrigger || null,
      settings: {
        confirmation_interval_days: statusSummary.thresholdDays,
      },
      audit_logs: auditLogs,
    });
  } catch (error) {
    return sendError(res, 500, error.message || 'Failed to fetch life status');
  }
};

const adminOverrideLifeStatus = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return sendError(res, 403, 'Admin access required');
    }

    const actorUserId = getUserId(req);
    const targetUserId = String(req.body?.target_user_id || '').trim();
    const action = String(req.body?.action || '').trim();
    const reason = String(req.body?.reason || '').trim() || null;
    const overrideHoursRaw = Number(req.body?.override_hours);
    const overrideHours = Number.isFinite(overrideHoursRaw) && overrideHoursRaw > 0
      ? overrideHoursRaw
      : DEFAULT_ADMIN_OVERRIDE_HOURS;

    if (!targetUserId) {
      return sendError(res, 400, 'target_user_id is required');
    }

    if (!['mark_active', 'mark_inactive'].includes(action)) {
      return sendError(res, 400, 'action must be mark_active or mark_inactive');
    }

    const overrideUntil = new Date(Date.now() + overrideHours * 60 * 60 * 1000);
    const forceActive = action === 'mark_active';
    await setUserActiveState({ userId: targetUserId, isActive: forceActive });
    await setUserEmergencyActive({ userId: targetUserId, emergencyActive: !forceActive });

    let trigger = await getActiveEmergencyTriggerByUserId(targetUserId);

    if (forceActive) {
      await resolveActiveEmergencyTriggersByUserId({ userId: targetUserId });
    } else if (!trigger) {
      trigger = await createEmergencyTrigger({
        userId: targetUserId,
        triggerReason: 'admin_override_inactive',
      });
    }

    const settings = await updateUserLifeSettings({
      userId: targetUserId,
      adminOverrideState: forceActive ? 'active' : 'inactive',
      adminOverrideUntil: overrideUntil,
      adminOverrideReason: reason,
      adminOverrideBy: actorUserId,
    });

    const audit = await createLifeAuditLog({
      targetUserId,
      actorUserId,
      actorType: 'admin',
      action: forceActive ? 'admin_override_mark_active' : 'admin_override_mark_inactive',
      details: {
        override_until: overrideUntil,
        override_hours: overrideHours,
        reason,
      },
    });

    return sendOk(res, {
      message: 'Admin override applied successfully',
      settings,
      audit,
      emergency_active: !forceActive,
      emergency_trigger: forceActive ? null : trigger,
    });
  } catch (error) {
    return sendError(res, 500, error.message || 'Failed to apply admin override');
  }
};

module.exports = {
  confirmLife,
  updateLifeSettings,
  getLifeStatus,
  adminOverrideLifeStatus,
};
