import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import AppButton from '../../../../components/AppButton';
import AppInput from '../../../../components/ui/AppInput';
import AppHeader from '../../../../components/ui/AppHeader';
import useVoiceMedicine from '../../../../hooks/useVoiceMedicine';
import { api } from '../../../../src/api/client';
import { createMedicine } from '../../../../src/api/healthcare';
import { getActivePatientId } from '../../../../src/utils/caretakerModeStore';
import { colors } from '../../../../theme/colors';
import { spacing } from '../../../../theme/spacing';
import { typography } from '../../../../theme/typography';

const initialForm = {
  name: '',
  dosage: '',
  times_per_day: '',
  time_slots: '',
  start_date: '',
  end_date: '',
  notes: '',
};

export default function AddMedicineScreen() {
  const [form, setForm] = useState(initialForm);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingFromVoice, setIsCreatingFromVoice] = useState(false);
  const {
    isListening,
    transcript,
    voiceError,
    startListening,
    stopListening,
    setTranscript,
  } = useVoiceMedicine();

  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert('Missing name', 'Medicine name is required.');
      return;
    }

    try {
      setIsSaving(true);
      const payload = {
        name: form.name.trim(),
        dosage: form.dosage.trim(),
        times_per_day: Number(form.times_per_day),
        time_slots: form.time_slots
          .split(',')
          .map((slot) => slot.trim())
          .filter(Boolean),
        notes: form.notes.trim(),
      };

      if (!payload.times_per_day || payload.time_slots.length === 0) {
        Alert.alert('Missing schedule', 'Times per day and at least one time slot are required.');
        return;
      }

      const res = await createMedicine(payload);
      console.log('Medicine created:', res.data);
      Alert.alert('Saved', 'Medicine created successfully.');
      router.replace('/healthcare/medicines');
    } catch (error) {
      console.log('Medicine create error:', error.response?.data || error.message);
      Alert.alert('Error', error.response?.data?.message || 'Failed to save medicine.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleVoiceCreate = async () => {
    if (!transcript.trim()) {
      Alert.alert('No voice text', 'Record a medicine instruction first.');
      return;
    }

    try {
      setIsCreatingFromVoice(true);
      const response = await api.post('/api/voice/medicine', {
        text: transcript.trim(),
        voice_text: transcript.trim(),
        patient_id: await getActivePatientId(),
      });
      console.log('Medicine created:', response.data);
      Alert.alert('Medicine created', response.data?.message || 'Created from voice input.');
      setTranscript('');
    } catch (error) {
      console.log('Medicine create error:', error.response?.data || error.message);
      Alert.alert('Voice input failed', error.response?.data?.message || 'Unable to create medicine from voice.');
    } finally {
      setIsCreatingFromVoice(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Add Medicine" showBack />
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.voiceCard}>
            <Text style={styles.voiceTitle}>Quick add with voice</Text>
            <Text style={styles.voiceHint}>Example: Take paracetamol every morning at 8</Text>
            <AppButton
              title={isListening ? 'Stop Listening' : 'Speak Medicine'}
              leftIcon={isListening ? 'mic-off-outline' : 'mic-outline'}
              variant={isListening ? 'danger' : 'secondary'}
              onPress={isListening ? stopListening : startListening}
            />
            <View style={styles.transcriptBox}>
              <Text style={styles.transcriptLabel}>Transcript</Text>
              <Text style={styles.transcriptText}>{transcript || 'No speech captured yet.'}</Text>
            </View>
            {voiceError ? <Text style={styles.errorText}>{voiceError}</Text> : null}
            <AppButton
              title="Create From Voice"
              loading={isCreatingFromVoice}
              onPress={handleVoiceCreate}
            />
          </View>

          <Text style={styles.sectionTitle}>Manual entry</Text>
          <AppInput label="Medicine name" value={form.name} onChangeText={(v) => updateField('name', v)} placeholder="Paracetamol" />
          <AppInput label="Dosage" value={form.dosage} onChangeText={(v) => updateField('dosage', v)} placeholder="500mg" />
          <AppInput
            label="Times per day"
            value={form.times_per_day}
            onChangeText={(v) => updateField('times_per_day', v)}
            placeholder="2"
            keyboardType="number-pad"
          />
          <AppInput
            label="Time slots"
            value={form.time_slots}
            onChangeText={(v) => updateField('time_slots', v)}
            placeholder="08:00, 20:00"
          />
          <AppInput
            label="Start date"
            value={form.start_date}
            onChangeText={(v) => updateField('start_date', v)}
            placeholder="2026-03-13"
          />
          <AppInput
            label="End date"
            value={form.end_date}
            onChangeText={(v) => updateField('end_date', v)}
            placeholder="2026-03-20"
          />
          <AppInput
            label="Notes"
            value={form.notes}
            onChangeText={(v) => updateField('notes', v)}
            placeholder="After meals"
            multiline
          />
          <AppButton title="Save Medicine" loading={isSaving} onPress={handleSave} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboard: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  voiceCard: {
    borderRadius: 22,
    backgroundColor: colors.cardMuted,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  voiceTitle: {
    ...typography.headingMedium,
    color: colors.textPrimary,
  },
  voiceHint: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  transcriptBox: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  transcriptLabel: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  transcriptText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  sectionTitle: {
    ...typography.headingMedium,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
  },
});

