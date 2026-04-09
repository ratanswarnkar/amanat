import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import AppButton from '../../components/AppButton';
import AppCard from '../../components/ui/AppCard';
import AppHeader from '../../components/ui/AppHeader';
import AppInput from '../../components/ui/AppInput';
import { createNominee } from '../../src/api/nominee';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

export default function AddNomineeScreen() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    const cleanedPhone = phone.replace(/\D/g, '').slice(-10);
    const trimmedRelationship = relationship.trim();

    if (!trimmedName || !trimmedRelationship || !cleanedPhone) {
      Toast.show({
        type: 'error',
        text1: 'Missing fields',
        text2: 'Name, phone, and relationship are required.',
      });
      return;
    }

    if (!/^\d{10}$/.test(cleanedPhone)) {
      Toast.show({
        type: 'error',
        text1: 'Invalid phone',
        text2: 'Enter a valid 10-digit phone number.',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await createNominee({
        name: trimmedName,
        phone: cleanedPhone,
        relationship: trimmedRelationship,
      });

      Toast.show({ type: 'success', text1: 'Nominee added', text2: 'Nominee created successfully.' });
      router.back();
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Failed to add nominee.';
      Toast.show({ type: 'error', text1: 'Add failed', text2: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Add Nominee" showBack />
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <AppCard variant="elevated" style={styles.card}>
            <Text style={styles.title}>Nominee Details</Text>
            <Text style={styles.subtitle}>Add trusted contact details for secure access.</Text>

            <AppInput
              label="Name"
              placeholder="Rahul Sharma"
              value={name}
              onChangeText={setName}
            />

            <AppInput
              label="Phone"
              placeholder="9876543210"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />

            <AppInput
              label="Relationship"
              placeholder="Brother"
              value={relationship}
              onChangeText={setRelationship}
            />

            <AppButton
              title="Save Nominee"
              onPress={handleSubmit}
              loading={isSubmitting}
              disabled={isSubmitting}
            />
          </AppCard>
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
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  card: {
    borderRadius: 20,
  },
  title: {
    ...typography.headingMedium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
});
