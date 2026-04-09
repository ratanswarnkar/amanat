import { useContext, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';
import AppButton from '../../components/AppButton';
import AppCard from '../../components/ui/AppCard';
import AppHeader from '../../components/ui/AppHeader';
import AppInput from '../../components/ui/AppInput';
import { AuthContext } from '../../context/AuthContext';
import { useOtpCooldown } from '../../hooks/useOtpCooldown';
import { resendOtp, verifyOtp } from '../../src/api/auth';
import { removeOtpVerifiedToken, saveOtpVerifiedToken } from '../../src/utils/secureStore';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

export default function OtpScreen() {
  const params = useLocalSearchParams();
  const { mobile: storedMobile, updateStoredMobile, setSession } = useContext(AuthContext);
  const mobile = String(params.mobile || storedMobile || '');
  const isPinResetFlow = String(params.resetPin || '') === '1';
  const [otp, setOtp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const { isCoolingDown, labelSuffix, startCooldown } = useOtpCooldown({ cooldownSeconds: 30 });

  const handleVerify = async () => {
    if (!/^\d{10}$/.test(mobile)) {
      Toast.show({ type: 'error', text1: 'Invalid number', text2: 'Please re-enter mobile number.' });
      return;
    }

    if (!/^\d{6}$/.test(otp)) {
      Toast.show({ type: 'error', text1: 'Invalid OTP', text2: 'Enter a valid 6-digit OTP.' });
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await verifyOtp({ mobile, otp });
      if (response?.otp_verified_token) {
        await saveOtpVerifiedToken(response.otp_verified_token);
      } else {
        await removeOtpVerifiedToken();
      }
      await updateStoredMobile(mobile);
      await setSession({
        token: response?.token,
        refreshToken: response?.refreshToken,
        mobile,
        user: response?.user || null,
        roles: response?.roles || null,
      });
      Toast.show({ type: 'success', text1: 'Verified', text2: response?.message || 'OTP verified successfully.' });
      if (response?.hasPin && !isPinResetFlow) {
        await removeOtpVerifiedToken();
        if (response?.user?.hasSecurityQuestions === false) {
          router.replace('/security-questions/setup');
          return;
        }
        if (response?.roles?.nominee) {
          router.replace('/role-select');
          return;
        }
        router.replace('/(tabs)');
      } else {
        router.replace({ pathname: '/set-pin', params: { mobile } });
      }
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'OTP verification failed.';
      Toast.show({ type: 'error', text1: 'Verification failed', text2: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (isCoolingDown) {
      return;
    }

    if (!/^\d{10}$/.test(mobile)) {
      Toast.show({ type: 'error', text1: 'Invalid number', text2: 'Please re-enter mobile number.' });
      return;
    }

    try {
      setIsResending(true);
      await resendOtp(mobile);
      startCooldown();
      Toast.show({ type: 'success', text1: 'OTP resent', text2: 'Please check your messages.' });
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Failed to resend OTP.';
      Toast.show({ type: 'error', text1: 'Resend failed', text2: message });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Verify OTP" showBack />
      <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
          <AppCard variant="elevated" style={styles.card}>
            <Text style={styles.title}>Verify OTP</Text>
            <Text style={styles.subtitle}>Enter the 6-digit OTP sent to {mobile || 'your number'}.</Text>

            <AppInput
              label="OTP"
              placeholder="123456"
              keyboardType="number-pad"
              value={otp}
              onChangeText={setOtp}
            />

            <AppButton title="Verify OTP" onPress={handleVerify} loading={isSubmitting} />
            <AppButton
              title={`Resend OTP${labelSuffix}`}
              onPress={handleResend}
              loading={isResending}
              disabled={isCoolingDown || isResending}
              variant="secondary"
              style={styles.resendButton}
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
  resendButton: {
    marginTop: spacing.sm,
  },
});
