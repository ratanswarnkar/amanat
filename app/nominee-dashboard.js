import { router, useFocusEffect, useRootNavigationState } from 'expo-router';
import { useCallback, useContext, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import AppButton from '../components/AppButton';
import AppCard from '../components/ui/AppCard';
import AppHeader from '../components/ui/AppHeader';
import AppLoader from '../components/ui/AppLoader';
import EmptyState from '../components/ui/EmptyState';
import { AuthContext } from '../context/AuthContext';
import { getNomineeAccessFiles, getNomineeAccessStatus } from '../src/api/nomineeAccess';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

const formatDate = (value) => {
  if (!value) return '--';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '--';
  return parsed.toLocaleString();
};

export default function NomineeDashboardScreen() {
  const { userRole, logout } = useContext(AuthContext);
  const navState = useRootNavigationState();
  const [status, setStatus] = useState(null);
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!navState?.key) return;

    if (userRole === 'user') {
      router.replace('/dashboard');
      return;
    }

    if (userRole === null) {
      router.replace('/login');
    }
  }, [userRole, navState]);

  const loadData = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const [statusResponse, filesResponse] = await Promise.all([
        getNomineeAccessStatus(),
        getNomineeAccessFiles(),
      ]);

      setStatus(statusResponse?.grant || null);
      setFiles(Array.isArray(filesResponse) ? filesResponse : []);
    } catch (error) {
      const message =
        error?.response?.data?.message || error?.message || 'Unable to load nominee access.';
      Toast.show({ type: 'error', text1: 'Access failed', text2: message });
      setStatus(null);
      setFiles([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (userRole === 'nominee') {
        loadData();
      }
    }, [loadData, userRole])
  );

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const handleViewFile = (item) => {
    router.push({
      pathname: '/amanat/vault-viewer',
      params: {
        id: String(item?.id || ''),
        file_url: String(item?.file_url || ''),
        file_type: String(item?.file_type || ''),
        file_name: String(item?.file_name || ''),
      },
    });
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <AppHeader title="Nominee Dashboard" rightIcon="log-out-outline" onRightPress={handleLogout} />
        <AppLoader text="Loading nominee access..." />
      </View>
    );
  }

  const hasAccess = Boolean(status);

  return (
    <View style={styles.container}>
      <AppHeader title="Nominee Dashboard" rightIcon="log-out-outline" onRightPress={handleLogout} />
      <View style={styles.content}>
        <AppCard style={styles.heroCard}>
          <Text style={styles.heading}>Emergency Access</Text>
          <Text style={styles.statusText}>
            Status: {hasAccess ? 'Active read-only access' : 'No active access'}
          </Text>
          <Text style={styles.infoText}>
            {hasAccess
              ? `Read-only vault access is active until ${formatDate(status?.expires_at)}.`
              : 'Nominee access becomes available only after backend emergency grant activation.'}
          </Text>
          {hasAccess ? (
            <Text style={styles.metaText}>
              Files available: {status?.file_count ?? files.length} | Scope: {status?.access_scope || 'read_only'}
            </Text>
          ) : null}
        </AppCard>

        {hasAccess ? (
          <FlatList
            data={files}
            keyExtractor={(item) => String(item.id)}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadData(true)} />}
            contentContainerStyle={files.length === 0 ? styles.emptyContent : styles.listContent}
            ListEmptyComponent={
              <EmptyState
                icon="folder-open-outline"
                title="No files available"
                message="There are no backend-granted vault files available for this nominee."
              />
            }
            renderItem={({ item }) => (
              <AppCard style={styles.itemCard}>
                <Text style={styles.fileTitle}>{item.file_name || 'Vault file'}</Text>
                <Text style={styles.fileMeta}>{item.file_type || 'Unknown type'}</Text>
                <Text style={styles.fileMeta}>Read-only access</Text>
                <AppButton
                  title="View File"
                  onPress={() => handleViewFile(item)}
                  variant="secondary"
                  size="small"
                  style={styles.fileButton}
                />
              </AppCard>
            )}
          />
        ) : (
          <EmptyState
            icon="shield-outline"
            title="Emergency access inactive"
            message="Login requires nominee OTP verification, owner security questions, and an active backend grant."
            buttonText="Nominee Access Login"
            onButtonPress={() => router.replace('/nominee-access-login')}
          />
        )}

        <AppButton title="Logout" onPress={handleLogout} style={styles.logoutButton} variant="danger" />
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
  heroCard: {
    marginBottom: spacing.md,
  },
  heading: {
    ...typography.headingLarge,
    color: colors.textPrimary,
    marginBottom: spacing.sm + spacing.xs,
  },
  statusText: {
    color: colors.textPrimary,
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.sm + spacing.xs,
  },
  infoText: {
    color: colors.textSecondary,
    ...typography.body,
    fontSize: 15,
    marginBottom: spacing.sm,
  },
  metaText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  listContent: {
    paddingBottom: spacing.md,
  },
  itemCard: {
    marginBottom: spacing.sm + 2,
  },
  fileTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  fileMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  fileButton: {
    marginTop: spacing.sm,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  logoutButton: {
    marginTop: spacing.sm,
  },
});
