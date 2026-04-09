import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import AppCard from '../../../../components/ui/AppCard';
import AppHeader from '../../../../components/ui/AppHeader';
import AppLoader from '../../../../components/ui/AppLoader';
import CaretakerModeBanner from '../../../../components/ui/CaretakerModeBanner';
import EmptyState from '../../../../components/ui/EmptyState';
import { getInventory } from '../../../../src/api/healthcare';
import { colors } from '../../../../theme/colors';
import { spacing } from '../../../../theme/spacing';
import { typography } from '../../../../theme/typography';

export default function InventoryScreen() {
  const [inventory, setInventory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadInventory = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      const data = await getInventory();
      setInventory(data);
    } catch (error) {
      console.log('Failed to load inventory', error.response?.data || error.message);
      setInventory([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadInventory();
    }, [loadInventory])
  );

  return (
    <View style={styles.container}>
      <AppHeader title="Inventory" showBack />
      <View style={styles.content}>
        <CaretakerModeBanner />
        {isLoading ? (
          <AppLoader text="Loading inventory..." />
        ) : (
          <FlatList
            data={inventory}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={() => loadInventory(true)} />
            }
            contentContainerStyle={inventory.length === 0 ? styles.emptyContent : styles.listContent}
            ListEmptyComponent={
              <EmptyState
                icon="cube-outline"
                title="No inventory available"
                message="Inventory entries will appear here once stock is configured in the backend."
              />
            }
            renderItem={({ item }) => {
              const isLowStock = Number(item.quantity_remaining) < Number(item.refill_threshold);
              return (
                <AppCard variant="elevated" style={styles.card}>
                  <View style={styles.row}>
                    <Text style={styles.name}>{item.medicine_name || 'Medicine'}</Text>
                    <View style={[styles.stockBadge, isLowStock ? styles.lowBadge : styles.okBadge]}>
                      <Text style={[styles.stockBadgeText, isLowStock ? styles.lowText : styles.okText]}>
                        {isLowStock ? 'Low stock' : 'Stable'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.meta}>Remaining quantity: {item.quantity_remaining}</Text>
                  <Text style={styles.meta}>Total quantity: {item.quantity_total}</Text>
                  <Text style={styles.meta}>Refill threshold: {item.refill_threshold}</Text>
                </AppCard>
              );
            }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, padding: spacing.lg },
  listContent: { paddingBottom: spacing.xl },
  emptyContent: { flexGrow: 1, justifyContent: 'center' },
  card: { borderRadius: 18, backgroundColor: colors.cardElevated },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  name: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  stockBadge: {
    borderRadius: 999,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  stockBadgeText: {
    ...typography.caption,
    fontWeight: '700',
  },
  lowBadge: {
    backgroundColor: colors.cardMuted,
  },
  okBadge: {
    backgroundColor: colors.secondary,
  },
  lowText: {
    color: colors.danger,
  },
  okText: {
    color: colors.success,
  },
});

