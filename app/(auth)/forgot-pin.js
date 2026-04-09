import { useContext, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';
import AppButton from '../../components/AppButton';
import AppCard from '../../components/ui/AppCard';
import AppHeader from '../../components/ui/AppHeader';
import AppInput from '../../components/ui/AppInput';
import { AuthContext } from '../../context/AuthContext';
import { sendOtp } from '../../src/api/auth';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

export default function ForgotPinScreen() {
  const params = useLocalSearchParams();
  const { mobile: storedMobile, updateStoredMobile } = useContext(AuthContext);
  const [mobile, setMobile] = useState(String(params.mobile || storedMobile || ''));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = async () => {
    if (!/^\d{10}$/.test(mobile)) {
      Toast.show({ type: 'error', text1: 'Invalid number', text2: 'Enter a valid 10-digit mobile number.' });
      return;
    }

    try {
      setIsSubmitting(true);
      await sendOtp(mobile);
      await updateStoredMobile(mobile);
      Toast.show({ type: 'success', text1: 'OTP sent', text2: 'Enter the 6-digit OTP to continue.' });
      router.push({ pathname: '/otp', params: { mobile, resetPin: '1' } });
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Failed to send OTP.';
      Toast.show({ type: 'error', text1: 'OTP failed', text2: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Forgot PIN" showBack />
      <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
          <AppCard variant="elevated" style={styles.card}>
            <Text style={styles.title}>Forgot PIN</Text>
            <Text style={styles.subtitle}>Verify your mobile number to reset your PIN.</Text>

            <AppInput
              label="Mobile Number"
              placeholder="9876543210"
              keyboardType="number-pad"
              value={mobile}
              onChangeText={setMobile}
            />

            <AppButton title="Continue" onPress={handleContinue} loading={isSubmitting} />
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
  content: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    padding: spacing.lg,
  },
  title: {
    ...typography.headingLarge,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
});
