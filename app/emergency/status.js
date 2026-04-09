import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';
import AppCard from '../../components/ui/AppCard';
import AppHeader from '../../components/ui/AppHeader';
import AppLoader from '../../components/ui/AppLoader';
import { getEmergencyStatus } from '../../src/api/emergency';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

const formatDate = (value) => {
  if (!value) return '--';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '--';
  return parsed.toLocaleString();
};

export default function EmergencyStatusScreen() {
  const [status, setStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadStatus = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const data = await getEmergencyStatus();
      setStatus(data || null);
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Unable to fetch status.';
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

  if (isLoading) {
    return (
      <View style={styles.container}>
        <AppHeader title="Emergency Status" showBack />
        <AppLoader text="Loading status..." />
      </View>
    );
  }

  const emergencyActive = Boolean(status?.emergency_active);
  const activeTrigger = status?.active_trigger || null;
  const grants = Array.isArray(status?.active_grants) ? status.active_grants : [];

  return (
    <View style={styles.container}>
      <AppHeader title="Emergency Status" showBack />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadStatus(true)} />}
      >
        <AppCard variant="elevated" style={styles.stateCard}>
          <Text style={styles.cardTitle}>Current State</Text>
          <Text style={[styles.stateText, emergencyActive ? styles.activeText : styles.inactiveText]}>
            {emergencyActive ? 'Emergency Active' : 'Emergency Inactive'}
          </Text>
          <Text style={styles.metaText}>Started: {formatDate(activeTrigger?.triggered_at)}</Text>
          <Text style={styles.metaText}>Reason: {activeTrigger?.trigger_reason || '--'}</Text>
        </AppCard>

        <AppCard variant="elevated" style={styles.grantsCard}>
          <Text style={styles.cardTitle}>Nominee Access Grants</Text>
          <Text style={styles.metaText}>Active grants: {grants.length}</Text>

          {grants.length === 0 ? (
            <Text style={styles.emptyText}>No active nominee access grants.</Text>
          ) : (
            grants.map((grant) => (
              <View key={grant.id} style={styles.grantRow}>
                <Text style={styles.grantName}>{grant.nominee_name || 'Nominee'}</Text>
                <Text style={styles.grantMeta}>Phone: {grant.nominee_phone || '--'}</Text>
                <Text style={styles.grantMeta}>Expires: {formatDate(grant.expires_at)}</Text>
                <Text style={styles.grantMeta}>Status: {grant.status || '--'}</Text>
                <Text style={styles.grantMeta}>Scope: {grant.access_scope || 'read_only'}</Text>
                <Text style={styles.grantToken}>Access Token: {grant.token || '--'}</Text>
              </View>
            ))
          )}
        </AppCard>
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
  stateCard: {
    borderRadius: 18,
  },
  grantsCard: {
    borderRadius: 18,
    marginTop: spacing.md,
  },
  cardTitle: {
    ...typography.headingMedium,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  stateText: {
    ...typography.body,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  activeText: {
    color: colors.danger,
  },
  inactiveText: {
    color: colors.textSecondary,
  },
  metaText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  grantRow: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  grantName: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  grantMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  grantToken: {
    ...typography.caption,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
});
