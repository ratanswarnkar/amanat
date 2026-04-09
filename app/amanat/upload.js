import * as DocumentPicker from 'expo-document-picker';
import { router, useRootNavigationState } from 'expo-router';
import { useContext, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import AppButton from '../../components/AppButton';
import AppCard from '../../components/ui/AppCard';
import AppHeader from '../../components/ui/AppHeader';
import AppInput from '../../components/ui/AppInput';
import AppLoader from '../../components/ui/AppLoader';
import { AuthContext } from '../../context/AuthContext';
import { FileContext } from '../../context/FileContext';
import { uploadVaultFile } from '../../src/api/vault';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

export default function UploadDocumentScreen() {
  // useState keeps the typed document title in component state.
  const [title, setTitle] = useState('');
  // useState keeps the selected file object returned by DocumentPicker.
  const [selectedFile, setSelectedFile] = useState(null);
  const [titleError, setTitleError] = useState('');
  const [fileError, setFileError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const { refreshFiles } = useContext(FileContext);
  const { userRole } = useContext(AuthContext);
  const navState = useRootNavigationState();

  useEffect(() => {
    // Wait for root router readiness before auto-redirecting from effects.
    if (!navState?.key) return;

    // Protected screen: only owner role can upload files.
    if (userRole === 'nominee') {
      router.replace('/nominee-dashboard');
      return;
    }

    if (userRole === null) {
      router.replace('/login');
    }
  }, [userRole, navState]);

  const handleSelectFile = async () => {
    // DocumentPicker opens the native file picker and lets users choose supported file types.
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*', 'audio/*', 'video/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setSelectedFile(result.assets[0]);
      setFileError('');
    }
  };

  const handleSave = async () => {
    let hasError = false;

    // Form validation checks title and selected file before continuing.
    if (!title.trim()) {
      setTitleError('Document title is required.');
      hasError = true;
    } else {
      setTitleError('');
    }

    if (!selectedFile) {
      setFileError('Please select a file before saving.');
      hasError = true;
    } else {
      setFileError('');
    }

    if (hasError) {
      Alert.alert('Validation Error', 'Please fix the highlighted fields.');
      return;
    }

    try {
      setIsUploading(true);
      await uploadVaultFile(selectedFile);
      await refreshFiles();
      Alert.alert('Success', 'File uploaded successfully.');
      router.replace('/amanat/vault');
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Upload failed.';
      Alert.alert('Upload failed', message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Upload Document" showBack />
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        <AppCard variant="elevated">
          <Text style={styles.heading}>Secure Upload</Text>
          <Text style={styles.subtitle}>Add a title, choose a file, and store it in your vault.</Text>

          <AppInput
            label="Document Title"
            placeholder="Enter document title"
            value={title}
            onChangeText={(text) => {
              setTitle(text);
              if (titleError) setTitleError('');
            }}
            error={titleError}
          />

          <View style={styles.section}>
            <AppButton title="Select File" onPress={handleSelectFile} variant="secondary" />
            {fileError ? <Text style={styles.errorText}>{fileError}</Text> : null}
          </View>

          <Text style={styles.fileName}>
            {selectedFile ? `Selected: ${selectedFile.name}` : 'No file selected'}
          </Text>

          <AppButton
            title="Save"
            onPress={handleSave}
            style={styles.saveButton}
            variant="primary"
            loading={isUploading}
            disabled={isUploading}
          />
        </AppCard>
      </ScrollView>
      {isUploading ? <AppLoader text="Uploading file..." fullScreen /> : null}
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
  },
  contentContainer: {
    padding: spacing.lg,
    paddingTop: spacing.md,
  },
  section: {
    marginBottom: spacing.sm,
  },
  heading: {
    ...typography.headingMedium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  fileName: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 12,
    marginBottom: spacing.md,
  },
  saveButton: {
    marginTop: spacing.xs,
  },
});
