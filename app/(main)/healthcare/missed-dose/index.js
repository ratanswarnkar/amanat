import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import AppCard from '../../../../components/ui/AppCard';
import AppHeader from '../../../../components/ui/AppHeader';
import AppLoader from '../../../../components/ui/AppLoader';
import CaretakerModeBanner from '../../../../components/ui/CaretakerModeBanner';
import EmptyState from '../../../../components/ui/EmptyState';
import { getAdherenceSummary, getTodayMedicines } from '../../../../src/api/healthcare';
import { colors } from '../../../../theme/colors';
import { spacing } from '../../../../theme/spacing';
import { typography } from '../../../../theme/typography';

export default function MissedDoseScreen() {
  const [summary, setSummary] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      const [summaryResponse, todayResponse] = await Promise.all([
        getAdherenceSummary(),
        getTodayMedicines(),
      ]);
      setSummary(summaryResponse);
      setSchedule(todayResponse.filter((item) => item.status === 'missed' || item.status === 'pending'));
    } catch (error) {
      console.log('Failed to load adherence summary', error.response?.data || error.message);
      setSummary(null);
      setSchedule([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  return (
    <View style={styles.container}>
      <AppHeader title="Missed Dose" showBack />
      <View style={styles.content}>
        <CaretakerModeBanner />
        {isLoading ? (
          <AppLoader text="Loading adherence..." />
        ) : (
          <FlatList
            data={schedule}
            keyExtractor={(item) => `${item.medicine_id}-${item.time}`}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={() => loadData(true)} />
            }
            ListHeaderComponent={
              summary ? (
                <AppCard variant="elevated" style={styles.summaryCard}>
                  <Text style={styles.summaryTitle}>Adherence Summary</Text>
                  <Text style={styles.summaryText}>Total doses: {summary.total_doses}</Text>
                  <Text style={styles.summaryText}>Taken doses: {summary.taken_doses}</Text>
                  <Text style={styles.summaryText}>Missed doses: {summary.missed_doses}</Text>
                  <Text style={styles.summaryText}>Adherence: {summary.adherence_percentage}%</Text>
                </AppCard>
              ) : null
            }
            contentContainerStyle={schedule.length === 0 ? styles.emptyContent : styles.listContent}
            ListEmptyComponent={
              <EmptyState
                icon="checkmark-done-outline"
                title="No missed or pending doses"
                message="Your recent medicine adherence looks clear."
              />
            }
            renderItem={({ item }) => (
              <AppCard variant="elevated" style={styles.card}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>Scheduled time: {item.time}</Text>
                <Text style={[styles.status, item.status === 'missed' ? styles.missed : styles.pending]}>
                  {item.status}
                </Text>
              </AppCard>
            )}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, padding: spacing.lg },
  summaryCard: {
    borderRadius: 20,
    backgroundColor: colors.cardMuted,
    marginBottom: spacing.md,
  },
  summaryTitle: {
    ...typography.headingMedium,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  summaryText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    borderRadius: 18,
    backgroundColor: colors.cardElevated,
  },
  name: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  status: {
    ...typography.caption,
    fontWeight: '700',
    marginTop: spacing.sm,
    textTransform: 'capitalize',
  },
  missed: {
    color: colors.danger,
  },
  pending: {
    color: colors.warning,
  },
});

