import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useRootNavigationState } from 'expo-router';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AppButton from '../../components/AppButton';
import AppCard from '../../components/ui/AppCard';
import EmptyState from '../../components/ui/EmptyState';
import AppHeader from '../../components/ui/AppHeader';
import AppInput from '../../components/ui/AppInput';
import AppLoader from '../../components/ui/AppLoader';
import { AuthContext } from '../../context/AuthContext';
import { deleteVaultEntry, getVaultEntries, searchVaultEntries } from '../../src/api/vault';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

const FILTERS = ['all', 'password', 'bank', 'custom'];
const SORT_OPTIONS = ['latest', 'oldest'];

const formatEntryDate = (value) => {
  if (!value) return 'No update date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'No update date';
  return `Updated ${parsed.toLocaleDateString()}`;
};

const getEncryptedLabel = (type) => {
  if (type === 'bank') return 'Encrypted Bank';
  if (type === 'custom') return 'Encrypted Custom';
  return 'Encrypted';
};

const maskValue = (value = '') => {
  const length = Math.max(String(value).length, 8);
  return '*'.repeat(Math.min(length, 12));
};

function FilterChip({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function EntryCard({ entry, onEdit, onDelete }) {
  const previewFields = entry.fields.slice(0, 2);

  return (
    <AppCard variant="elevated" style={styles.entryCard} onPress={onEdit}>
      <View style={styles.entryTopRow}>
        <View style={styles.entryMain}>
          <View style={styles.entryIconWrap}>
            <Ionicons name="lock-closed-outline" size={22} color={colors.primary} />
          </View>

          <View style={styles.entryTextWrap}>
            <Text style={styles.entryTitle} numberOfLines={1}>
              {entry.title}
            </Text>
            <Text style={styles.entryDescription} numberOfLines={1}>
              {formatEntryDate(entry.updated_at || entry.created_at)}
            </Text>
          </View>
        </View>

        <Ionicons name="chevron-forward-outline" size={20} color={colors.textSecondary} />
      </View>

      <View style={styles.entryMetaRow}>
        <View style={styles.encryptedPill}>
          <Text style={styles.encryptedPillText}>{getEncryptedLabel(entry.type)}</Text>
        </View>
        <Text style={styles.entryType}>{entry.type}</Text>
      </View>

      {previewFields.length ? (
        <View style={styles.previewWrap}>
          {previewFields.map((field) => (
            <View key={field.id || field.label} style={styles.previewRow}>
              <Text style={styles.previewLabel} numberOfLines={1}>
                {field.label}
              </Text>
              <Text style={styles.previewValue} numberOfLines={1}>
                {maskValue(field.value)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.entryActions}>
        <AppButton title="Edit" variant="secondary" size="small" onPress={onEdit} />
        <AppButton title="Delete" variant="danger" size="small" onPress={onDelete} />
      </View>
    </AppCard>
  );
}

export default function CredentialsVaultScreen() {
  const { userRole } = useContext(AuthContext);
  const navState = useRootNavigationState();
  const [entries, setEntries] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeType, setActiveType] = useState('all');
  const [sortBy, setSortBy] = useState('latest');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!navState?.key) return;

    if (userRole === 'nominee') {
      router.replace('/nominee-dashboard');
      return;
    }

    if (userRole === null) {
      router.replace('/login');
    }
  }, [userRole, navState]);

  const loadEntries = useCallback(
    async ({ refresh = false, queryOverride } = {}) => {
      try {
        if (refresh) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        setErrorMessage('');
        const normalizedQuery = String(queryOverride ?? searchQuery).trim();
        const data = normalizedQuery
          ? await searchVaultEntries({ query: normalizedQuery, type: activeType, sort: sortBy })
          : await getVaultEntries({ type: activeType, sort: sortBy });

        setEntries(data);
      } catch (error) {
        setErrorMessage(error?.response?.data?.message || error?.message || 'Failed to load vault entries.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [activeType, searchQuery, sortBy]
  );

  useFocusEffect(
    useCallback(() => {
      loadEntries();
    }, [loadEntries])
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadEntries({ queryOverride: searchQuery });
    }, 320);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, activeType, sortBy, loadEntries]);

  const handleDelete = (entry) => {
    Alert.alert('Delete vault entry', `Delete "${entry.title}" from your vault?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
          onPress: async () => {
            try {
              await deleteVaultEntry(entry.id);
              await loadEntries({ refresh: true, queryOverride: searchQuery });
            } catch (error) {
              Alert.alert('Delete failed', error?.response?.data?.message || error?.message || 'Please try again.');
            }
        },
      },
    ]);
  };

  const summary = useMemo(() => {
    return `${entries.length} secure entr${entries.length === 1 ? 'y' : 'ies'}`;
  }, [entries.length]);

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <AppHeader title="Secure Vault" showBack />
        <AppLoader text="Loading encrypted vault..." />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AppHeader title="Secure Vault" showBack />

      <ScrollView
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadEntries({ refresh: true })} />}
      >
        <AppCard variant="elevated" style={styles.heroCard}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>SECURE VAULT ENTRIES</Text>
            <Text style={styles.heroTitle}>Encrypted entries for passwords, banking, and private details.</Text>
            <Text style={styles.heroSubtitle}>{summary}</Text>
          </View>
          <View style={styles.heroIconWrap}>
            <Ionicons name="lock-closed-outline" size={24} color={colors.primary} />
          </View>
        </AppCard>

        <AppCard variant="outlined" style={styles.searchCard}>
          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={20} color={colors.primary} style={styles.searchIcon} />
            <View style={styles.searchInputWrap}>
              <AppInput
                placeholder="Search titles or field labels"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>
        </AppCard>

        <AppCard variant="outlined" style={styles.filtersCard}>
          <Text style={styles.sectionLabel}>Filter by type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {FILTERS.map((item) => (
              <FilterChip
                key={item}
                label={item === 'all' ? 'All' : item[0].toUpperCase() + item.slice(1)}
                active={activeType === item}
                onPress={() => setActiveType(item)}
              />
            ))}
          </ScrollView>

          <Text style={styles.sectionLabel}>Sort</Text>
          <View style={styles.sortRow}>
            {SORT_OPTIONS.map((item) => (
              <FilterChip
                key={item}
                label={item === 'latest' ? 'Latest' : 'Oldest'}
                active={sortBy === item}
                onPress={() => setSortBy(item)}
              />
            ))}
          </View>

          <AppButton
            title="Add Entry"
            leftIcon="add-outline"
            size="small"
            onPress={() => router.push('/amanat/vault-entry-form')}
          />
        </AppCard>

        {errorMessage ? (
          <AppCard variant="outlined" style={styles.errorCard}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </AppCard>
        ) : null}

        {entries.length === 0 ? (
          <EmptyState
            icon="key-outline"
            title="No secure entries yet"
            message="Add your first secure entry to keep passwords, bank details, and custom notes protected."
            buttonText="Add Entry"
            onButtonPress={() => router.push('/amanat/vault-entry-form')}
          />
        ) : (
          entries.map((item) => (
            <EntryCard
              key={item.id}
              entry={item}
              onEdit={() =>
                router.push({
                  pathname: '/amanat/vault-entry-form',
                  params: {
                    mode: 'edit',
                    entry: JSON.stringify(item),
                  },
                })
              }
              onDelete={() => handleDelete(item)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  heroCopy: {
    flex: 1,
    marginRight: spacing.md,
  },
  heroEyebrow: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  heroTitle: {
    ...typography.headingMedium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  heroSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchCard: {
    marginBottom: spacing.md,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInputWrap: {
    flex: 1,
  },
  filtersCard: {
    marginBottom: spacing.md,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  filterRow: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  sortRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 1,
    borderRadius: 999,
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primaryStrong,
    borderColor: colors.primaryStrong,
  },
  filterChipText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: colors.textPrimary,
  },
  entryCard: {
    borderRadius: 18,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  entryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  entryMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  entryIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  entryTextWrap: {
    flex: 1,
  },
  entryTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: 2,
  },
  entryDescription: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  entryMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  encryptedPill: {
    borderRadius: 999,
    paddingHorizontal: spacing.sm + spacing.xs,
    paddingVertical: spacing.xs,
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  encryptedPillText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  entryType: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  previewWrap: {
    marginBottom: spacing.md,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  previewLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
    flex: 1,
  },
  previewValue: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  entryActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  errorCard: {
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '700',
  },
});
