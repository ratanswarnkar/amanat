import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import AppButton from '../../../../components/AppButton';
import AppCard from '../../../../components/ui/AppCard';
import AppHeader from '../../../../components/ui/AppHeader';
import AppLoader from '../../../../components/ui/AppLoader';
import CaretakerModeBanner from '../../../../components/ui/CaretakerModeBanner';
import EmptyState from '../../../../components/ui/EmptyState';
import {
  getTodayMedicines,
  markMedicineMissed,
  markMedicineTaken,
} from '../../../../src/api/healthcare';
import { colors } from '../../../../theme/colors';
import { spacing } from '../../../../theme/spacing';
import { typography } from '../../../../theme/typography';

const statusColor = {
  pending: colors.warning,
  taken: colors.success,
  missed: colors.danger,
};

export default function TodayMedicinesScreen() {
  const [schedule, setSchedule] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingKey, setLoadingKey] = useState('');

  const loadSchedule = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      const data = await getTodayMedicines();
      setSchedule(data);
    } catch (error) {
      console.log("Failed to load today's medicines", error.response?.data || error.message);
      setSchedule([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSchedule();
    }, [loadSchedule])
  );

  const handleStatusUpdate = async (item, status) => {
    try {
      setLoadingKey(`${item.medicine_id}-${status}`);
      const fn = status === 'taken' ? markMedicineTaken : markMedicineMissed;
      const response = await fn({
        medicine_id: item.medicine_id,
        scheduled_time: item.time,
      });

      if (response.low_stock_alert) {
        Alert.alert('Low stock', 'Inventory is below refill threshold for this medicine.');
      }

      await loadSchedule(true);
    } catch (error) {
      Alert.alert('Update failed', error.response?.data?.message || 'Unable to update medicine status.');
    } finally {
      setLoadingKey('');
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Today's Medicines" />
      <View style={styles.content}>
        <CaretakerModeBanner />
        {isLoading ? (
          <AppLoader text="Loading today's schedule..." />
        ) : (
          <FlatList
            data={schedule}
            keyExtractor={(item) => `${item.medicine_id}-${item.time}`}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={() => loadSchedule(true)} />
            }
            contentContainerStyle={schedule.length === 0 ? styles.emptyContent : styles.listContent}
            ListEmptyComponent={
              <EmptyState
                icon="calendar-outline"
                title="No doses scheduled"
                message="Today's medicines will appear here when your routine is active."
              />
            }
            renderItem={({ item }) => (
              <AppCard variant="elevated" style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.name}>{item.name}</Text>
                  <View style={[styles.badge, { backgroundColor: `${statusColor[item.status] || colors.primary}18` }]}>
                    <Text style={[styles.badgeText, { color: statusColor[item.status] || colors.primary }]}>
                      {item.status}
                    </Text>
                  </View>
                </View>
                <Text style={styles.time}>Scheduled at {item.time}</Text>
                {item.status === 'pending' ? (
                  <View style={styles.actions}>
                    <AppButton
                      title="Mark Taken"
                      size="small"
                      loading={loadingKey === `${item.medicine_id}-taken`}
                      onPress={() => handleStatusUpdate(item, 'taken')}
                    />
                    <AppButton
                      title="Mark Missed"
                      size="small"
                      variant="outline"
                      loading={loadingKey === `${item.medicine_id}-missed`}
                      onPress={() => handleStatusUpdate(item, 'missed')}
                    />
                  </View>
                ) : null}
              </AppCard>
            )}
          />
        )}
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.md,
  },
  time: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    ...typography.caption,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});

