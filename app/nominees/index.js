import { useCallback, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';
import AppButton from '../../components/AppButton';
import NomineeCard from '../../components/nominee/NomineeCard';
import AppCard from '../../components/ui/AppCard';
import AppHeader from '../../components/ui/AppHeader';
import AppLoader from '../../components/ui/AppLoader';
import EmptyState from '../../components/ui/EmptyState';
import { deleteNominee, getNominees } from '../../src/api/nominee';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

export default function NomineeListScreen() {
  const [nominees, setNominees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState('');

  const loadNominees = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const data = await getNominees();
      setNominees(data);
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Unable to load nominees.';
      setNominees([]);
      Toast.show({ type: 'error', text1: 'Load failed', text2: message });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadNominees();
    }, [loadNominees])
  );

  const handleDelete = (nominee) => {
    Alert.alert('Delete nominee', `Remove ${nominee?.name || 'this nominee'}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setDeletingId(String(nominee.id));
            await deleteNominee(nominee.id);
            setNominees((prev) => prev.filter((item) => String(item.id) !== String(nominee.id)));
            Toast.show({ type: 'success', text1: 'Deleted', text2: 'Nominee removed successfully.' });
          } catch (error) {
            const message = error?.response?.data?.message || error?.message || 'Failed to delete nominee.';
            Toast.show({ type: 'error', text1: 'Delete failed', text2: message });
          } finally {
            setDeletingId('');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Nominees" showBack />

      <View style={styles.content}>
        <AppCard variant="elevated" style={styles.topBar}>
          <View style={styles.topTextWrap}>
            <Text style={styles.heading}>Trusted Nominees</Text>
            <Text style={styles.subheading}>Manage and verify nominee access securely.</Text>
          </View>
          <AppButton
            title="Add Nominee"
            size="small"
            leftIcon="add-outline"
            onPress={() => router.push('/nominees/add')}
          />
        </AppCard>

        {isLoading ? (
          <AppLoader text="Loading nominees..." />
        ) : (
          <FlatList
            data={nominees}
            keyExtractor={(item) => String(item.id)}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={() => loadNominees(true)} />
            }
            contentContainerStyle={nominees.length === 0 ? styles.emptyContent : styles.listContent}
            ListEmptyComponent={
              <EmptyState
                icon="people-outline"
                title="No nominees added"
                message="Add your first nominee to begin secure access setup."
                buttonText="Add Nominee"
                onButtonPress={() => router.push('/nominees/add')}
              />
            }
            renderItem={({ item }) => (
              <NomineeCard
                nominee={item}
                isDeleting={deletingId === String(item.id)}
                isVerifying={false}
                onDelete={() => handleDelete(item)}
                onVerify={() =>
                  router.push({
                    pathname: '/nominees/verify',
                    params: {
                      nomineeId: String(item.id),
                      nomineeName: String(item.name || ''),
                    },
                  })
                }
              />
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  topTextWrap: {
    flex: 1,
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
});
