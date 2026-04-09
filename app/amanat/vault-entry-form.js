import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useRootNavigationState } from 'expo-router';
import { useContext, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AppButton from '../../components/AppButton';
import AppCard from '../../components/ui/AppCard';
import AppHeader from '../../components/ui/AppHeader';
import AppInput from '../../components/ui/AppInput';
import AppLoader from '../../components/ui/AppLoader';
import { AuthContext } from '../../context/AuthContext';
import { createVaultEntry, updateVaultEntry } from '../../src/api/vault';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

const TYPE_OPTIONS = [
  { value: 'password', label: 'Password' },
  { value: 'bank', label: 'Bank' },
  { value: 'custom', label: 'Custom' },
];

const createEmptyField = () => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  label: '',
  value: '',
});

function TypeOption({ option, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.typeOption, active && styles.typeOptionActive]}>
      <Text style={[styles.typeOptionText, active && styles.typeOptionTextActive]}>{option.label}</Text>
    </Pressable>
  );
}

export default function VaultEntryFormScreen() {
  const params = useLocalSearchParams();
  const { userRole } = useContext(AuthContext);
  const navState = useRootNavigationState();
  const mode = String(params?.mode || 'create');

  const parsedEntry = useMemo(() => {
    try {
      return params?.entry ? JSON.parse(String(params.entry)) : null;
    } catch (_error) {
      return null;
    }
  }, [params?.entry]);

  const [title, setTitle] = useState(parsedEntry?.title || '');
  const [type, setType] = useState(parsedEntry?.type || 'password');
  const [fields, setFields] = useState(
    parsedEntry?.fields?.length
      ? parsedEntry.fields.map((field) => ({
          id: field.id || createEmptyField().id,
          label: field.label || '',
          value: field.value || '',
        }))
      : [createEmptyField()]
  );
  const [titleError, setTitleError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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

  const handleFieldChange = (fieldId, key, value) => {
    setFields((prev) =>
      prev.map((field) => (field.id === fieldId ? { ...field, [key]: value } : field))
    );
    if (fieldError) {
      setFieldError('');
    }
  };

  const handleAddField = () => {
    setFields((prev) => [...prev, createEmptyField()]);
  };

  const handleRemoveField = (fieldId) => {
    if (fields.length === 1) {
      return;
    }

    setFields((prev) => prev.filter((field) => field.id !== fieldId));
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    const normalizedFields = fields
      .map((field) => ({
        label: field.label.trim(),
        value: field.value.trim(),
      }))
      .filter((field) => field.label || field.value);

    if (!trimmedTitle) {
      setTitleError('Entry title is required.');
      return;
    }

    if (normalizedFields.length === 0 || normalizedFields.some((field) => !field.label || !field.value)) {
      setFieldError('Each field needs both a label and a value.');
      return;
    }

    try {
      setIsSaving(true);
      const payload = {
        title: trimmedTitle,
        type,
        fields: normalizedFields,
      };

      if (mode === 'edit' && parsedEntry?.id) {
        await updateVaultEntry(parsedEntry.id, payload);
      } else {
        await createVaultEntry(payload);
      }

      router.replace('/amanat/credentials-vault');
    } catch (error) {
      Alert.alert('Save failed', error?.response?.data?.message || error?.message || 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <AppHeader title={mode === 'edit' ? 'Edit Vault Entry' : 'Add Vault Entry'} showBack />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        <AppCard style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons name="key-outline" size={22} color="#1D4ED8" />
          </View>
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroTitle}>Build a secure entry</Text>
            <Text style={styles.heroSubtitle}>
              Add unlimited encrypted fields for passwords, bank details, or custom secrets.
            </Text>
          </View>
        </AppCard>

        <AppInput
          label="Entry Title"
          placeholder="Gmail, SBI Bank, Trading Account"
          value={title}
          onChangeText={(value) => {
            setTitle(value);
            if (titleError) setTitleError('');
          }}
          error={titleError}
        />

        <Text style={styles.label}>Entry Type</Text>
        <View style={styles.typeRow}>
          {TYPE_OPTIONS.map((option) => (
            <TypeOption
              key={option.value}
              option={option}
              active={type === option.value}
              onPress={() => setType(option.value)}
            />
          ))}
        </View>

        <View style={styles.fieldsHeader}>
          <Text style={styles.fieldsTitle}>Dynamic Fields</Text>
          <AppButton title="Add Field" size="small" variant="secondary" leftIcon="add" onPress={handleAddField} />
        </View>

        {fields.map((field, index) => (
          <AppCard key={field.id} style={styles.fieldCard}>
            <View style={styles.fieldCardHeader}>
              <Text style={styles.fieldCardTitle}>Field {index + 1}</Text>
              {fields.length > 1 ? (
                <Pressable onPress={() => handleRemoveField(field.id)} style={styles.removeFieldButton}>
                  <Ionicons name="trash-outline" size={18} color="#DC2626" />
                </Pressable>
              ) : null}
            </View>

            <AppInput
              label="Label"
              placeholder="Email, Username, Account Number"
              value={field.label}
              onChangeText={(value) => handleFieldChange(field.id, 'label', value)}
            />
            <AppInput
              label="Value"
              placeholder="Enter secure value"
              value={field.value}
              onChangeText={(value) => handleFieldChange(field.id, 'value', value)}
              secureTextEntry
            />
          </AppCard>
        ))}

        {fieldError ? <Text style={styles.errorText}>{fieldError}</Text> : null}

        <AppButton
          title={mode === 'edit' ? 'Update Entry' : 'Save Entry'}
          onPress={handleSave}
          loading={isSaving}
          disabled={isSaving}
          style={styles.saveButton}
        />
      </ScrollView>

      {isSaving ? <AppLoader text="Saving encrypted vault entry..." fullScreen /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F4F8FF',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DCE7FF',
    borderRadius: 22,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  heroTextWrap: {
    flex: 1,
  },
  heroTitle: {
    ...typography.headingMedium,
    color: '#102A56',
    fontWeight: '800',
    marginBottom: 4,
  },
  heroSubtitle: {
    ...typography.caption,
    color: '#5B6F96',
    lineHeight: 20,
  },
  label: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  typeOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#EFF4FF',
    borderWidth: 1,
    borderColor: '#D2E1FF',
  },
  typeOptionActive: {
    backgroundColor: '#1F6FEB',
    borderColor: '#1F6FEB',
  },
  typeOptionText: {
    ...typography.caption,
    color: '#35538F',
    fontWeight: '800',
  },
  typeOptionTextActive: {
    color: '#FFFFFF',
  },
  fieldsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  fieldsTitle: {
    ...typography.headingMedium,
    color: '#102A56',
    fontSize: 20,
  },
  fieldCard: {
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderColor: '#DCE7FF',
  },
  fieldCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  fieldCardTitle: {
    ...typography.body,
    color: '#102A56',
    fontWeight: '800',
  },
  removeFieldButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF1F2',
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginBottom: spacing.md,
  },
  saveButton: {
    marginTop: spacing.sm,
  },
});
