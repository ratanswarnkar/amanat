import { useContext, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import AppButton from '../../components/AppButton';
import AppCard from '../../components/ui/AppCard';
import BrandMark from '../../components/ui/BrandMark';
import AppHeader from '../../components/ui/AppHeader';
import AppInput from '../../components/ui/AppInput';
import { AuthContext } from '../../context/AuthContext';
import { sendOtp } from '../../src/api/auth';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

export default function MobileAuthScreen() {
  const { updateStoredMobile } = useContext(AuthContext);
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = async () => {
    if (!/^\d{10}$/.test(phone)) {
      Toast.show({ type: 'error', text1: 'Invalid phone', text2: 'Enter a valid 10-digit phone number.' });
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await sendOtp(phone);
      await updateStoredMobile(phone);
      Toast.show({ type: 'success', text1: 'OTP sent', text2: response?.message || 'Please verify OTP.' });
      router.push({ pathname: '/otp', params: { mobile: phone } });
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Failed to send OTP.';
      Toast.show({ type: 'error', text1: 'Request failed', text2: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Welcome" />
      <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
          <AppCard variant="elevated" style={styles.card}>
            <View style={styles.brandWrap}>
              <BrandMark />
            </View>
            <Text style={styles.title}>Welcome to Amanat</Text>
            <Text style={styles.subtitle}>Continue with your mobile number.</Text>

            <AppInput
              label="Phone"
              placeholder="9876543210"
              keyboardType="number-pad"
              value={phone}
              onChangeText={setPhone}
            />

            <AppButton title="Send OTP" onPress={handleContinue} loading={isSubmitting} />
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
  brandWrap: {
    marginBottom: spacing.md,
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
