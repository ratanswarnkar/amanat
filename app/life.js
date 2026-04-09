import { useCallback, useContext, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';
import AppButton from '../components/AppButton';
import AppCard from '../components/ui/AppCard';
import AppHeader from '../components/ui/AppHeader';
import AppInput from '../components/ui/AppInput';
import AppLoader from '../components/ui/AppLoader';
import { AuthContext } from '../context/AuthContext';
import { adminOverrideLifeStatus, confirmLife, getLifeStatus, updateLifeSettings } from '../src/api/life';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

const formatDate = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString();
};

export default function LifeStatusScreen() {
  const { user } = useContext(AuthContext);
  const [status, setStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [intervalDays, setIntervalDays] = useState('7');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [targetUserId, setTargetUserId] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideHours, setOverrideHours] = useState('24');
  const [isApplyingOverride, setIsApplyingOverride] = useState(false);

  const loadStatus = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const data = await getLifeStatus();
      setStatus(data || null);
      const nextInterval = String(data?.settings?.confirmation_interval_days || data?.threshold_days || 7);
      setIntervalDays(nextInterval);
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Unable to load life status.';
      Toast.show({ type: 'error', text1: 'Status failed', text2: message });
      setStatus(null);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStatus();
    }, [loadStatus])
  );

  useEffect(() => {
    const timer = setInterval(() => {
      loadStatus(true);
    }, 15000);

    return () => clearInterval(timer);
  }, [loadStatus]);

  const handleConfirmLife = async () => {
    try {
      setIsConfirming(true);
      const response = await confirmLife({ source: 'mobile_app' });
      Toast.show({
        type: 'success',
        text1: 'Confirmation saved',
        text2: response?.message || 'Your life confirmation has been recorded.',
      });
      await loadStatus(true);
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Failed to confirm life status.';
      Toast.show({ type: 'error', text1: 'Confirmation failed', text2: message });
    } finally {
      setIsConfirming(false);
    }
  };

  const handleSaveSettings = async () => {
    const parsed = Number(intervalDays);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 365) {
      Toast.show({ type: 'error', text1: 'Invalid interval', text2: 'Enter a value between 1 and 365 days.' });
      return;
    }

    try {
      setIsSavingSettings(true);
      const response = await updateLifeSettings({ confirmation_interval_days: parsed });
      Toast.show({
        type: 'success',
        text1: 'Settings saved',
        text2: response?.message || 'Life confirmation interval updated.',
      });
      await loadStatus(true);
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Failed to update life settings.';
      Toast.show({ type: 'error', text1: 'Update failed', text2: message });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleAdminOverride = async (action) => {
    const normalizedUserId = String(targetUserId || '').trim();
    const parsedHours = Number(overrideHours);

    if (!normalizedUserId) {
      Toast.show({ type: 'error', text1: 'Missing user', text2: 'Target user ID is required.' });
      return;
    }

    if (!Number.isInteger(parsedHours) || parsedHours < 1 || parsedHours > 720) {
      Toast.show({ type: 'error', text1: 'Invalid duration', text2: 'Override hours must be between 1 and 720.' });
      return;
    }

    try {
      setIsApplyingOverride(true);
      const response = await adminOverrideLifeStatus({
        target_user_id: normalizedUserId,
        action,
        reason: overrideReason.trim(),
        override_hours: parsedHours,
      });
      Toast.show({
        type: 'success',
        text1: 'Override applied',
        text2: response?.message || 'Admin override applied successfully.',
      });
      setTargetUserId('');
      setOverrideReason('');
      setOverrideHours('24');
      await loadStatus(true);
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Failed to apply admin override.';
      Toast.show({ type: 'error', text1: 'Override failed', text2: message });
    } finally {
      setIsApplyingOverride(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <AppHeader title="Life Status" showBack />
        <AppLoader text="Loading life status..." />
      </View>
    );
  }

  const lastConfirmation = status?.last_confirmation_at || null;
  const daysSince = status?.days_since_last_confirmation;
  const nextDue = status?.next_confirmation_due_at || null;
  const inactive = Boolean(status?.inactive);
  const isAdminUser = user?.role === 'admin';

  return (
    <View style={styles.container}>
      <AppHeader title="Life Status" showBack />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadStatus(true)} />}
      >
        <AppCard variant="elevated" style={styles.mainCard}>
          <Text style={styles.mainTitle}>Life Confirmation</Text>
          <Text style={styles.mainText}>
            The backend now evaluates inactivity on a schedule and triggers emergency mode if confirmation is missed.
          </Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Last confirmation</Text>
            <Text style={styles.infoValue}>{formatDate(lastConfirmation)}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Days since last confirmation</Text>
            <Text style={styles.infoValue}>{daysSince ?? '--'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Next confirmation due</Text>
            <Text style={styles.infoValue}>{formatDate(nextDue)}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Current status</Text>
            <Text style={[styles.infoValue, inactive ? styles.dangerText : styles.safeText]}>
              {inactive ? 'Inactive / emergency active' : 'Active'}
            </Text>
          </View>

          {status?.override_active ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Admin override</Text>
              <Text style={styles.infoValue}>{String(status?.override_state || '').toUpperCase()}</Text>
            </View>
          ) : null}

          <AppButton
            title="I am alive"
            onPress={handleConfirmLife}
            loading={isConfirming}
            disabled={isConfirming}
            style={styles.confirmButton}
          />
        </AppCard>

        <AppCard variant="outlined" style={styles.settingsCard}>
          <Text style={styles.sectionTitle}>Confirmation Settings</Text>
          <Text style={styles.sectionText}>Choose how often the server should expect confirmation.</Text>
          <AppInput
            label="Interval (days)"
            placeholder="7"
            keyboardType="number-pad"
            value={intervalDays}
            onChangeText={setIntervalDays}
          />
          <AppButton
            title="Save Interval"
            onPress={handleSaveSettings}
            loading={isSavingSettings}
            disabled={isSavingSettings}
            variant="secondary"
          />
        </AppCard>

        <AppCard variant="outlined" style={styles.settingsCard}>
          <Text style={styles.sectionTitle}>Audit Logs</Text>
          {(status?.audit_logs || []).length === 0 ? (
            <Text style={styles.sectionText}>No audit logs yet.</Text>
          ) : (
            (status?.audit_logs || []).map((item) => (
              <View key={item.id} style={styles.auditRow}>
                <Text style={styles.auditAction}>{item.action}</Text>
                <Text style={styles.auditMeta}>
                  {item.actor_type} | {formatDate(item.created_at)}
                </Text>
              </View>
            ))
          )}
        </AppCard>

        {isAdminUser ? (
          <AppCard variant="outlined" style={styles.settingsCard}>
            <Text style={styles.sectionTitle}>Admin Override</Text>
            <Text style={styles.sectionText}>
              Force a user active or inactive for a limited duration. All actions are audited.
            </Text>
            <AppInput
              label="Target User ID"
              placeholder="UUID"
              value={targetUserId}
              onChangeText={setTargetUserId}
            />
            <AppInput
              label="Reason"
              placeholder="Reason for override"
              value={overrideReason}
              onChangeText={setOverrideReason}
            />
            <AppInput
              label="Override Hours"
              placeholder="24"
              keyboardType="number-pad"
              value={overrideHours}
              onChangeText={setOverrideHours}
            />
            <AppButton
              title="Mark Active"
              onPress={() => handleAdminOverride('mark_active')}
              loading={isApplyingOverride}
              disabled={isApplyingOverride}
              variant="secondary"
            />
            <AppButton
              title="Mark Inactive"
              onPress={() => handleAdminOverride('mark_inactive')}
              loading={isApplyingOverride}
              disabled={isApplyingOverride}
              style={styles.adminButton}
              variant="danger"
            />
          </AppCard>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  mainCard: {
    borderRadius: 18,
    marginBottom: spacing.md,
  },
  settingsCard: {
    marginBottom: spacing.md,
  },
  mainTitle: {
    ...typography.headingMedium,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  mainText: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  infoRow: {
    backgroundColor: colors.cardMuted,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  infoLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  infoValue: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  safeText: {
    color: colors.success,
  },
  dangerText: {
    color: colors.danger,
  },
  confirmButton: {
    marginTop: spacing.md,
  },
  sectionTitle: {
    ...typography.headingMedium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  sectionText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  auditRow: {
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  auditAction: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  auditMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  adminButton: {
    marginTop: spacing.sm,
  },
});
