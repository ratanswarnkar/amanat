import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import AppButton from '../../../../components/AppButton';
import AppCard from '../../../../components/ui/AppCard';
import AppHeader from '../../../../components/ui/AppHeader';
import AppInput from '../../../../components/ui/AppInput';
import AppLoader from '../../../../components/ui/AppLoader';
import CaretakerModeBanner from '../../../../components/ui/CaretakerModeBanner';
import EmptyState from '../../../../components/ui/EmptyState';
import { getHealthRecords, uploadHealthRecord } from '../../../../src/api/healthcare';
import { colors } from '../../../../theme/colors';
import { spacing } from '../../../../theme/spacing';
import { typography } from '../../../../theme/typography';

const initialForm = {
  title: '',
  record_type: '',
  record_date: '',
  notes: '',
};
const ALLOWED_PICKER_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

const normalizeMimeType = (rawType = '', rawName = '') => {
  const type = String(rawType || '').toLowerCase().trim();
  if (type === 'image/jpg') {
    return 'image/jpeg';
  }
  if (type) {
    return type;
  }

  const fileName = String(rawName || '').toLowerCase();
  if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) return 'image/jpeg';
  if (fileName.endsWith('.png')) return 'image/png';
  if (fileName.endsWith('.pdf')) return 'application/pdf';
  return '';
};

export default function HealthRecordsScreen() {
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const loadRecords = async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const data = await getHealthRecords();
      setRecords(data);
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Failed to load health records.';
      Alert.alert('Load failed', message);
      setRecords([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const handlePickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/jpeg', 'image/png', 'application/pdf'],
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const file = result.assets[0];
    const mimeType = normalizeMimeType(file?.mimeType, file?.name);
    if (!ALLOWED_PICKER_TYPES.includes(mimeType)) {
      Alert.alert('Invalid file', 'Only JPEG, PNG, and PDF files are allowed.');
      return;
    }

    const normalizedSelectedFile = {
      uri: file.uri,
      name: file.name,
      type: mimeType,
    };
    console.log('Selected file:', normalizedSelectedFile);
    setSelectedFile(normalizedSelectedFile);
  };

  const handleUpload = async () => {
    if (!selectedFile || !form.title.trim() || !form.record_type.trim()) {
      Alert.alert('Missing details', 'Title, record type, and file are required.');
      return;
    }

    if (!ALLOWED_PICKER_TYPES.includes(String(selectedFile.type || '').toLowerCase())) {
      Alert.alert('Invalid file', 'Only JPEG, PNG, and PDF files are allowed.');
      return;
    }

    if (form.record_date.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(form.record_date.trim())) {
      Alert.alert('Invalid date', 'Record date must be in YYYY-MM-DD format.');
      return;
    }

    try {
      setIsUploading(true);
      console.log('[HealthRecord UI] uploading', {
        title: form.title,
        record_type: form.record_type,
        record_date: form.record_date,
        notesLength: form.notes.length,
      });

      await uploadHealthRecord({
        title: form.title.trim(),
        record_type: form.record_type.trim(),
        record_date: form.record_date.trim() || undefined,
        notes: form.notes.trim() || undefined,
        file: {
          uri: selectedFile.uri,
          name: selectedFile.name,
          type: selectedFile.type || 'application/octet-stream',
        },
      });

      setForm(initialForm);
      setSelectedFile(null);
      await loadRecords(true);
      Alert.alert('Uploaded', 'Health record uploaded successfully.');
    } catch (error) {
      console.log('[HealthRecord UI] upload error', {
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data,
      });
      const message = error?.response?.data?.message || error?.message || 'Could not upload health record.';
      Alert.alert('Upload failed', message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Health Records" />
      <View style={styles.bannerContainer}>
        <CaretakerModeBanner />
      </View>
      <FlatList
        data={records}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => loadRecords(true)} />
        }
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <AppCard variant="elevated" style={styles.uploadCard}>
              <Text style={styles.formTitle}>Upload report or image</Text>
              <AppInput label="Title" value={form.title} onChangeText={(v) => setForm((c) => ({ ...c, title: v }))} placeholder="Blood test report" />
              <AppInput label="Record type" value={form.record_type} onChangeText={(v) => setForm((c) => ({ ...c, record_type: v }))} placeholder="Lab report" />
              <AppInput label="Record date" value={form.record_date} onChangeText={(v) => setForm((c) => ({ ...c, record_date: v }))} placeholder="2026-03-13" />
              <AppInput label="Notes" value={form.notes} onChangeText={(v) => setForm((c) => ({ ...c, notes: v }))} placeholder="Routine annual checkup" multiline />
              <AppButton title={selectedFile ? selectedFile.name : 'Choose PDF or Image'} variant="secondary" onPress={handlePickFile} />
              <AppButton title="Upload Record" loading={isUploading} onPress={handleUpload} />
            </AppCard>
            {isLoading ? <AppLoader text="Loading records..." /> : null}
          </View>
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyWrap}>
              <EmptyState
                icon="folder-open-outline"
                title="No records uploaded"
                message="Upload your prescriptions, scans, and reports to keep them ready."
              />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <AppCard variant="elevated" style={styles.recordCard}>
            <Text style={styles.recordTitle}>{item.title}</Text>
            <Text style={styles.recordMeta}>Type: {item.record_type}</Text>
            <Text style={styles.recordMeta}>Date: {item.record_date || 'Not specified'}</Text>
            <Text style={styles.recordMeta}>File: {item.file_url}</Text>
          </AppCard>
        )}
        contentContainerStyle={styles.content}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  bannerContainer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  headerContent: { marginBottom: spacing.md },
  uploadCard: { borderRadius: 20, backgroundColor: colors.cardMuted },
  formTitle: {
    ...typography.headingMedium,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  emptyWrap: {
    paddingTop: spacing.xl,
  },
  recordCard: {
    borderRadius: 18,
    backgroundColor: colors.cardElevated,
  },
  recordTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  recordMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
