import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import AppButton from '../../../../components/AppButton';
import AppCard from '../../../../components/ui/AppCard';
import AppHeader from '../../../../components/ui/AppHeader';
import CaretakerModeBanner from '../../../../components/ui/CaretakerModeBanner';
import AppLoader from '../../../../components/ui/AppLoader';
import EmptyState from '../../../../components/ui/EmptyState';
import { getMedicines } from '../../../../src/api/healthcare';
import { colors } from '../../../../theme/colors';
import { spacing } from '../../../../theme/spacing';
import { typography } from '../../../../theme/typography';

export default function MedicinesScreen() {
  const [medicines, setMedicines] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadMedicines = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      const data = await getMedicines();
      setMedicines(data);
    } catch (error) {
      console.log('Failed to load medicines', error.response?.data || error.message);
      setMedicines([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMedicines();
    }, [loadMedicines])
  );

  return (
    <View style={styles.container}>
      <AppHeader title="Medicine Tracker" />
      <View style={styles.content}>
        <CaretakerModeBanner />
        <View style={styles.actionRow}>
          <View>
            <Text style={styles.heading}>Your medicines</Text>
            <Text style={styles.subheading}>Daily prescriptions and routine schedules.</Text>
          </View>
          <AppButton
            title="Add"
            size="small"
            leftIcon="add-outline"
            onPress={() => router.push('/healthcare/medicines/add')}
          />
        </View>

        {isLoading ? (
          <AppLoader text="Loading medicines..." />
        ) : (
          <FlatList
            data={medicines}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={() => loadMedicines(true)} />
            }
            contentContainerStyle={medicines.length === 0 ? styles.emptyContent : styles.listContent}
            ListEmptyComponent={
              <EmptyState
                icon="medkit-outline"
                title="No medicines yet"
                message="Add your first medicine schedule to start tracking doses."
              />
            }
            renderItem={({ item }) => (
              <AppCard variant="elevated" style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.pillIcon}>
                    <Ionicons name="medkit-outline" size={18} color={colors.primary} />
                  </View>
                  <Text style={styles.name}>{item.name}</Text>
                </View>
                <Text style={styles.meta}>Dosage: {item.dosage || 'Not specified'}</Text>
                <Text style={styles.meta}>Times per day: {item.times_per_day || item.time_slots?.length || 0}</Text>
                <Text style={styles.meta}>
                  Time slots: {Array.isArray(item.time_slots) && item.time_slots.length ? item.time_slots.join(', ') : 'None'}
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
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  heading: {
    ...typography.headingMedium,
    color: colors.textPrimary,
  },
  subheading: {
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
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  pillIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.cardMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
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
});

