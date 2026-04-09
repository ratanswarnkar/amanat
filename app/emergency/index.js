import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';
import AppButton from '../../components/AppButton';
import AppCard from '../../components/ui/AppCard';
import AppHeader from '../../components/ui/AppHeader';
import AppLoader from '../../components/ui/AppLoader';
import { grantEmergencyAccess, getEmergencyStatus, triggerEmergency } from '../../src/api/emergency';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

export default function EmergencyScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [isTriggering, setIsTriggering] = useState(false);
  const [isGranting, setIsGranting] = useState(false);
  const [status, setStatus] = useState({
    emergency_active: false,
    active_trigger: null,
    active_grants: [],
  });

  const loadStatus = useCallback(async () => {
    try {
      const data = await getEmergencyStatus();
      setStatus({
        emergency_active: Boolean(data?.emergency_active),
        active_trigger: data?.active_trigger || null,
        active_grants: Array.isArray(data?.active_grants) ? data.active_grants : [],
      });
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Unable to load emergency status.';
      Toast.show({ type: 'error', text1: 'Status failed', text2: message });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadStatus();
    }, [loadStatus])
  );

  const confirmTrigger = () => {
    Alert.alert(
      'Trigger Emergency',
      'This will activate emergency mode and notify verified nominees. Do you want to continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Trigger Now',
          style: 'destructive',
          onPress: handleTrigger,
        },
      ]
    );
  };

  const handleTrigger = async () => {
    try {
      setIsTriggering(true);
      const response = await triggerEmergency({ trigger_reason: 'manual_trigger' });
      Toast.show({
        type: 'success',
        text1: 'Emergency Activated',
        text2: response?.message || 'Emergency has been triggered successfully.',
      });
      await loadStatus();
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Failed to trigger emergency.';
      Toast.show({ type: 'error', text1: 'Trigger failed', text2: message });
    } finally {
      setIsTriggering(false);
    }
  };

  const handleGrantAccess = async () => {
    try {
      setIsGranting(true);
      const response = await grantEmergencyAccess({ expires_in_hours: 24 });
      Toast.show({
        type: 'success',
        text1: 'Access Granted',
        text2: response?.message || 'Vault access granted for verified nominees.',
      });
      await loadStatus();
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Failed to grant access.';
      Toast.show({ type: 'error', text1: 'Grant failed', text2: message });
    } finally {
      setIsGranting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <AppHeader title="Emergency" showBack />
        <AppLoader text="Loading emergency state..." />
      </View>
    );
  }

  const emergencyActive = Boolean(status.emergency_active);

  return (
    <View style={styles.container}>
      <AppHeader title="Emergency" showBack />
      <View style={styles.content}>
        <AppCard variant="elevated" style={styles.warningCard}>
          <Text style={styles.warningTitle}>Emergency Control Center</Text>
          <Text style={styles.warningText}>
            Use this only in critical situations. Triggering emergency will notify verified nominees and allow controlled vault access.
          </Text>
          <View style={[styles.statusPill, emergencyActive ? styles.statusActive : styles.statusInactive]}>
            <Text style={[styles.statusText, emergencyActive ? styles.statusActiveText : styles.statusInactiveText]}>
              {emergencyActive ? 'Emergency Active' : 'Emergency Inactive'}
            </Text>
          </View>
        </AppCard>

        <AppButton
          title={emergencyActive ? 'Emergency Already Active' : 'Trigger Emergency'}
          onPress={confirmTrigger}
          loading={isTriggering}
          disabled={emergencyActive || isTriggering || isGranting}
          variant="danger"
          style={styles.triggerButton}
        />

        <AppButton
          title="Grant Vault Access (24h)"
          onPress={handleGrantAccess}
          loading={isGranting}
          disabled={!emergencyActive || isGranting || isTriggering}
          variant="secondary"
        />

        <AppButton
          title="View Emergency Status"
          variant="outline"
          onPress={() => router.push('/emergency/status')}
          style={styles.statusButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  warningCard: {
    borderRadius: 18,
    marginBottom: spacing.lg,
  },
  warningTitle: {
    ...typography.headingMedium,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  warningText: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  statusPill: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: spacing.sm + spacing.xs,
    paddingVertical: spacing.xs,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '700',
  },
  statusActive: {
    backgroundColor: colors.danger,
  },
  statusInactive: {
    backgroundColor: colors.cardMuted,
  },
  statusActiveText: {
    color: colors.background,
  },
  statusInactiveText: {
    color: colors.textSecondary,
  },
  triggerButton: {
    marginBottom: spacing.sm,
  },
  statusButton: {
    marginTop: spacing.md,
  },
});
