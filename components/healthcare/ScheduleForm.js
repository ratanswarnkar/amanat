import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import AppButton from '../AppButton';
import AppInput from '../ui/AppInput';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

const REPEAT_OPTIONS = ['daily', 'weekly', 'custom'];
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const normalizeTimeValue = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return null;
  }

  if (/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/.test(normalized)) {
    return normalized;
  }

  return TIME_PATTERN.test(normalized) ? `${normalized}:00` : null;
};

export default function ScheduleForm({
  initialValues,
  submitLabel,
  submittingLabel,
  onSubmit,
  onCancel,
  isSubmitting = false,
  showCancel = false,
}) {
  const [medicineName, setMedicineName] = useState('');
  const [dosage, setDosage] = useState('');
  const [repeatType, setRepeatType] = useState('daily');
  const [timeInput, setTimeInput] = useState('');
  const [times, setTimes] = useState([]);
  const initialMedicineName = initialValues?.medicine_name;
  const initialDosage = initialValues?.dosage;
  const initialRepeatType = initialValues?.repeat_type;
  const initialTimes = initialValues?.times;

  useEffect(() => {
    setMedicineName(String(initialMedicineName || '').trim());
    setDosage(String(initialDosage || '').trim());
    setRepeatType(REPEAT_OPTIONS.includes(initialRepeatType) ? initialRepeatType : 'daily');
    setTimes(Array.isArray(initialTimes) ? initialTimes.map(normalizeTimeValue).filter(Boolean) : []);
    setTimeInput('');
  }, [initialDosage, initialMedicineName, initialRepeatType, initialTimes]);

  const sortedTimes = [...times].sort();

  const addTime = () => {
    const parsed = normalizeTimeValue(timeInput);
    if (!parsed) {
      Alert.alert('Invalid time', 'Enter time in HH:MM format, for example 08:30.');
      return;
    }

    if (times.includes(parsed)) {
      setTimeInput('');
      return;
    }

    setTimes((previous) => [...previous, parsed]);
    setTimeInput('');
  };

  const removeTime = (value) => {
    setTimes((previous) => previous.filter((item) => item !== value));
  };

  const handleSubmit = async () => {
    if (!medicineName.trim()) {
      Alert.alert('Missing medicine', 'Medicine name is required.');
      return;
    }

    if (times.length === 0) {
      Alert.alert('Missing time', 'Add at least one schedule time.');
      return;
    }

    await onSubmit?.({
      medicine_name: medicineName.trim(),
      dosage: dosage.trim(),
      repeat_type: repeatType,
      time: times,
    });
  };

  return (
    <View>
      <AppInput
        label="Medicine Name"
        value={medicineName}
        onChangeText={setMedicineName}
        placeholder="Paracetamol"
      />
      <AppInput
        label="Dosage"
        value={dosage}
        onChangeText={setDosage}
        placeholder="500mg"
      />

      <Text style={styles.label}>Repeat Type</Text>
      <View style={styles.repeatRow}>
        {REPEAT_OPTIONS.map((option) => (
          <AppButton
            key={option}
            title={option}
            size="small"
            variant={repeatType === option ? 'primary' : 'secondary'}
            onPress={() => setRepeatType(option)}
            disabled={isSubmitting}
          />
        ))}
      </View>

      <Text style={styles.label}>Times (multiple allowed)</Text>
      <View style={styles.timeInputRow}>
        <TextInput
          value={timeInput}
          onChangeText={setTimeInput}
          placeholder="08:30"
          placeholderTextColor={colors.textSecondary}
          style={styles.timeInput}
          editable={!isSubmitting}
        />
        <AppButton title="Add" size="small" onPress={addTime} disabled={isSubmitting} />
      </View>

      <View style={styles.timeList}>
        {sortedTimes.map((value) => (
          <AppButton
            key={value}
            title={`${value.slice(0, 5)} x`}
            size="small"
            variant="outline"
            onPress={() => removeTime(value)}
            disabled={isSubmitting}
          />
        ))}
      </View>

      <AppButton
        title={isSubmitting ? (submittingLabel || submitLabel) : submitLabel}
        loading={isSubmitting}
        disabled={isSubmitting}
        onPress={handleSubmit}
      />
      {showCancel ? (
        <AppButton
          title="Cancel"
          variant="ghost"
          onPress={onCancel}
          disabled={isSubmitting}
          style={styles.cancelButton}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  repeatRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  timeInputRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  timeInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.textPrimary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.backgroundAlt,
  },
  timeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  cancelButton: {
    marginTop: spacing.xs,
  },
});
