import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { router, useRootNavigationState } from 'expo-router';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import AppButton from '../../components/AppButton';
import AppCard from '../../components/ui/AppCard';
import EmptyState from '../../components/ui/EmptyState';
import AppHeader from '../../components/ui/AppHeader';
import AppInput from '../../components/ui/AppInput';
import AppLoader from '../../components/ui/AppLoader';
import PinModal from '../../components/ui/PinModal';
import { AuthContext } from '../../context/AuthContext';
import { verifyPin as verifyUserPin } from '../../src/api/auth';
import { EmergencyContext } from '../../context/EmergencyContext';
import { deleteVaultFile, getVaultFiles, uploadVaultFile } from '../../src/api/vault';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

const allowedMimePrefixes = ['image/', 'video/', 'audio/'];

const getFileCategory = (fileType, fileName) => {
  const lowerType = String(fileType || '').toLowerCase();
  const lowerName = String(fileName || '').toLowerCase();

  if (allowedMimePrefixes.some((prefix) => lowerType.startsWith(prefix))) return 'Media';
  if (lowerType.includes('pdf') || lowerName.endsWith('.pdf')) return 'PDF';
  return 'File';
};

const formatSize = (value) => {
  const size = Number(value || 0);
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
};

const getFileIcon = (fileType, fileName) => {
  const category = getFileCategory(fileType, fileName);
  if (category === 'PDF') return 'document-text-outline';
  if (category === 'Media') return 'images-outline';
  return 'folder-open-outline';
};

export default function VaultScreen() {
  const { userRole } = useContext(AuthContext);
  const { isEmergencyActive } = useContext(EmergencyContext);
  const navState = useRootNavigationState();

  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [pendingAction, setPendingAction] = useState(null);
  const [isPinModalVisible, setIsPinModalVisible] = useState(false);
  const [isPinSubmitting, setIsPinSubmitting] = useState(false);
  const [pinError, setPinError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

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

  const loadFiles = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setLoadError('');
      const data = await getVaultFiles();
      setFiles(data);
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Failed to load vault files.';
      setLoadError(message);
      setFiles([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handlePickAndUpload = async () => {
    try {
      const pickerResult = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'audio/*', 'video/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (pickerResult.canceled || !pickerResult.assets?.length) {
        return;
      }

      const selectedFile = pickerResult.assets[0];

      setIsUploading(true);
      await uploadVaultFile(selectedFile);
      await loadFiles(true);
      Alert.alert('Success', 'File uploaded successfully.');
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Upload failed.';
      Alert.alert('Upload failed', message);
    } finally {
      setIsUploading(false);
    }
  };

  const closePinModal = useCallback(() => {
    setIsPinModalVisible(false);
    setPendingAction(null);
    setPinError('');
    setIsPinSubmitting(false);
  }, []);

  const openPinModal = useCallback((action) => {
    setPendingAction(action);
    setPinError('');
    setIsPinModalVisible(true);
  }, []);

  const handleDelete = (item) => {
    openPinModal({
      type: 'delete',
      item,
      title: 'Verify PIN to delete',
      description: `Enter your PIN to delete ${item?.file_name || 'this file'}.`,
    });
  };

  const handleView = (item) => {
    openPinModal({
      type: 'view',
      item,
      title: 'Verify PIN to view',
      description: `Enter your PIN to open ${item?.file_name || 'this file'}.`,
    });
  };

  const handlePinSubmit = async (pin, resetPin) => {
    if (!/^\d{4}$/.test(pin)) {
      setPinError('PIN must be exactly 4 digits.');
      return;
    }

    if (!pendingAction?.item) {
      setPinError('No pending action found.');
      return;
    }

    try {
      setIsPinSubmitting(true);
      setPinError('');
      await verifyUserPin({ pin });

      if (pendingAction.type === 'view') {
        const item = pendingAction.item;
        closePinModal();
        resetPin?.();
        router.push({
          pathname: '/amanat/vault-viewer',
          params: {
            id: String(item?.id || ''),
            file_url: String(item?.file_url || ''),
            file_type: String(item?.file_type || ''),
            file_name: String(item?.file_name || ''),
          },
        });
        return;
      }

      if (pendingAction.type === 'delete') {
        const targetId = String(pendingAction.item.id || '');
        setDeletingId(targetId);
        await deleteVaultFile(targetId);
        await loadFiles(true);
        closePinModal();
        resetPin?.();
        Alert.alert('Success', 'File deleted successfully.');
      }
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Incorrect PIN';
      setPinError(message);
    } finally {
      setIsPinSubmitting(false);
      setDeletingId('');
    }
  };

  const visibleFiles = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return files;

    return files.filter((item) => {
      const name = String(item.file_name || '').toLowerCase();
      const type = String(item.file_type || '').toLowerCase();
      return name.includes(normalizedQuery) || type.includes(normalizedQuery);
    });
  }, [files, searchQuery]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <AppHeader title="My Vault" showBack onBackPress={() => router.replace('/dashboard')} />
        <AppLoader text="Loading vault files..." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader title="My Vault" showBack onBackPress={() => router.replace('/dashboard')} />

      <ScrollView
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadFiles(true)} />}
      >
        <AppCard variant="elevated" style={styles.heroCard}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>My Vault Files</Text>
            <Text style={styles.heroSubtitle}>
              {visibleFiles.length} secure file{visibleFiles.length === 1 ? '' : 's'} ready to view.
            </Text>
          </View>
          <View style={styles.heroIconWrap}>
            <Ionicons name="shield-checkmark-outline" size={24} color={colors.primary} />
          </View>
        </AppCard>

        <AppCard variant="outlined" style={styles.searchCard}>
          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={20} color={colors.primary} style={styles.searchIcon} />
            <View style={styles.searchInputWrap}>
              <AppInput
                placeholder="Search files"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>
        </AppCard>

        {isEmergencyActive ? (
          <AppCard variant="outlined" style={styles.bannerCard}>
            <Text style={styles.bannerText}>Emergency mode is active.</Text>
          </AppCard>
        ) : null}

        {loadError ? (
          <AppCard variant="outlined" style={styles.bannerCard}>
            <Text style={styles.errorText}>{loadError}</Text>
            <AppButton title="Retry" size="small" variant="secondary" onPress={() => loadFiles(true)} />
          </AppCard>
        ) : null}

        <AppButton
          title={isUploading ? 'Uploading...' : 'Upload File'}
          leftIcon="cloud-upload-outline"
          onPress={handlePickAndUpload}
          loading={isUploading}
          disabled={isUploading}
          style={styles.uploadButton}
        />

        {visibleFiles.length === 0 ? (
          <EmptyState
            icon="cloud-upload-outline"
            title="No secure files yet"
            message="Upload your first document to keep it encrypted and available from your vault."
            buttonText="Upload File"
            onButtonPress={handlePickAndUpload}
          />
        ) : (
          <View style={styles.fileGrid}>
            {visibleFiles.map((item) => {
              const isDeleting = deletingId === String(item.id);
              return (
                <AppCard key={String(item.id)} variant="elevated" style={styles.fileCard}>
                  <Pressable onPress={() => handleView(item)} style={styles.fileItem}>
                    <View style={styles.fileRow}>
                      <View style={styles.fileIconWrap}>
                        <Ionicons
                          name={getFileIcon(item.file_type, item.file_name)}
                          size={22}
                          color={colors.primary}
                        />
                      </View>

                      <View style={styles.fileCopy}>
                        <Text style={styles.fileName} numberOfLines={1}>
                          {item.file_name}
                        </Text>
                        <Text style={styles.fileMeta} numberOfLines={1}>
                          {getFileCategory(item.file_type, item.file_name)} / {formatSize(item.file_size)}
                        </Text>
                      </View>

                      <View style={styles.iconButton}>
                        <Ionicons name="eye-outline" size={20} color={colors.primary} />
                      </View>
                    </View>
                  </Pressable>

                  <View style={styles.fileActions}>
                    <AppButton title="View" size="small" variant="secondary" onPress={() => handleView(item)} />
                    <AppButton
                      title="Delete"
                      size="small"
                      variant="danger"
                      onPress={() => handleDelete(item)}
                      loading={isDeleting}
                      disabled={isDeleting}
                    />
                  </View>
                </AppCard>
              );
            })}
          </View>
        )}
      </ScrollView>

      <PinModal
        visible={isPinModalVisible}
        title={pendingAction?.title || 'Verify PIN'}
        description={pendingAction?.description || 'Enter your PIN to continue.'}
        submitLabel={pendingAction?.type === 'delete' ? 'Delete File' : 'View File'}
        error={pinError}
        loading={isPinSubmitting}
        onSubmit={handlePinSubmit}
        onClose={closePinModal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
  bannerCard: {
    marginBottom: spacing.md,
  },
  bannerText: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: '700',
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  uploadButton: {
    marginBottom: spacing.md,
  },
  fileGrid: {
    gap: spacing.md,
  },
  fileCard: {
    borderRadius: 18,
    padding: spacing.md,
    marginBottom: 0,
  },
  fileItem: {
    borderRadius: 14,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileIconWrap: {
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
  fileCopy: {
    flex: 1,
    marginRight: spacing.sm,
  },
  fileName: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: 2,
  },
  fileMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fileActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
