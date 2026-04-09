const cron = require('node-cron');

const {
  listLifeEvaluationCandidates,
  updateUserLifeSettings,
  upsertLifeCheckMissedForToday,
  createLifeAuditLog,
  setUserActiveState,
} = require('../models/lifeModel');
const {
  setUserEmergencyActive,
  getActiveEmergencyTriggerByUserId,
  createEmergencyTrigger,
  resolveActiveEmergencyTriggersByUserId,
} = require('../models/emergencyModel');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const evaluateUserLifeStatus = async (candidate) => {
  const thresholdDays = Number(candidate.confirmation_interval_days || process.env.LIFE_CONFIRMATION_MAX_DAYS || 7);
  const overrideState = candidate.admin_override_state || null;
  const overrideUntil = candidate.admin_override_until ? new Date(candidate.admin_override_until) : null;
  const overrideActive = Boolean(overrideState && overrideUntil && overrideUntil.getTime() > Date.now());

  const lastConfirmationAt = candidate.last_confirmation_at ? new Date(candidate.last_confirmation_at) : null;
  const daysSinceLastConfirmation = lastConfirmationAt
    ? Math.floor((Date.now() - lastConfirmationAt.getTime()) / MS_PER_DAY)
    : null;

  const computedInactive = lastConfirmationAt ? daysSinceLastConfirmation >= thresholdDays : false;
  const shouldBeInactive = overrideActive ? overrideState === 'inactive' : computedInactive;

  await updateUserLifeSettings({
    userId: candidate.user_id,
    lastEvaluatedAt: new Date(),
    clearAdminOverride: Boolean(overrideUntil && overrideUntil.getTime() <= Date.now()),
  });

  if (!shouldBeInactive) {
    if (candidate.is_active === false || candidate.emergency_active === true) {
      await setUserActiveState({ userId: candidate.user_id, isActive: true });
      await setUserEmergencyActive({ userId: candidate.user_id, emergencyActive: false });
      await resolveActiveEmergencyTriggersByUserId({ userId: candidate.user_id });
      await createLifeAuditLog({
        targetUserId: candidate.user_id,
        actorType: 'system',
        action: 'life_evaluation_active',
        details: {
          threshold_days: thresholdDays,
          days_since_last_confirmation: daysSinceLastConfirmation,
          override_active: overrideActive,
          override_state: overrideState,
        },
      });
    }
    return;
  }

  await upsertLifeCheckMissedForToday({ userId: candidate.user_id });
  await setUserActiveState({ userId: candidate.user_id, isActive: false });
  await setUserEmergencyActive({ userId: candidate.user_id, emergencyActive: true });

  let activeTrigger = await getActiveEmergencyTriggerByUserId(candidate.user_id);
  let triggeredNow = false;
  if (!activeTrigger) {
    activeTrigger = await createEmergencyTrigger({
      userId: candidate.user_id,
      triggerReason: overrideActive ? 'admin_override_inactive' : 'life_confirmation_inactive_threshold',
    });
    triggeredNow = true;
  }

  await createLifeAuditLog({
    targetUserId: candidate.user_id,
    actorType: 'system',
    action: 'life_evaluation_inactive',
    details: {
      threshold_days: thresholdDays,
      days_since_last_confirmation: daysSinceLastConfirmation,
      override_active: overrideActive,
      override_state: overrideState,
      emergency_triggered_now: triggeredNow,
      trigger_id: activeTrigger?.id || null,
    },
  });
};

cron.schedule('*/15 * * * *', async () => {
  try {
    const candidates = await listLifeEvaluationCandidates();
    for (const candidate of candidates) {
      await evaluateUserLifeStatus(candidate);
    }
  } catch (error) {
    console.error('Life inactivity engine error:', error.message);
  }
});

module.exports = {
  evaluateUserLifeStatus,
};
