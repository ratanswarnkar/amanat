import { useContext, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AppButton from '../../components/AppButton';
import AppCard from '../../components/ui/AppCard';
import AppHeader from '../../components/ui/AppHeader';
import AppInput from '../../components/ui/AppInput';
import { AuthContext } from '../../context/AuthContext';
import { loginWithPin, setPin } from '../../src/api/auth';
import { getOtpVerifiedToken, removeOtpVerifiedToken } from '../../src/utils/secureStore';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

export default function SetPinScreen() {
  const params = useLocalSearchParams();
  const { setSession } = useContext(AuthContext);
  const mobile = String(params.mobile || '');
  const [pin, setPinValue] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSetPin = async () => {
    if (!/^\d{10}$/.test(mobile)) {
      Alert.alert('Invalid mobile', 'Please restart login and verify OTP again.');
      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      Alert.alert('Invalid PIN', 'PIN must be exactly 4 digits.');
      return;
    }

    if (pin !== confirmPin) {
      Alert.alert('PIN mismatch', 'PIN and confirm PIN must match.');
      return;
    }

    try {
      setIsSubmitting(true);
      const otpVerifiedToken = await getOtpVerifiedToken();
      if (!otpVerifiedToken) {
        Alert.alert('Verification expired', 'Please verify OTP again before setting your PIN.');
        return;
      }

      await setPin({ mobile, pin, otp_verified_token: otpVerifiedToken });
      await removeOtpVerifiedToken();
      const loginResponse = await loginWithPin({ mobile, pin });
      await setSession({
        token: loginResponse.token,
        refreshToken: loginResponse.refreshToken,
        mobile,
        user: loginResponse.user || null,
        roles: loginResponse.roles || null,
      });
      if (loginResponse?.user?.hasSecurityQuestions === false) {
        router.replace('/security-questions/setup');
        return;
      }

      if (loginResponse?.roles?.nominee) {
        router.replace('/role-select');
        return;
      }

      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to set PIN.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Set PIN" showBack />
      <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
          <AppCard variant="elevated" style={styles.card}>
            <Text style={styles.title}>Set PIN</Text>
            <Text style={styles.subtitle}>Create a 4-digit PIN for future logins.</Text>

            <AppInput
              label="4-digit PIN"
              placeholder="1234"
              keyboardType="number-pad"
              value={pin}
              onChangeText={setPinValue}
              secureTextEntry
            />

            <AppInput
              label="Confirm PIN"
              placeholder="1234"
              keyboardType="number-pad"
              value={confirmPin}
              onChangeText={setConfirmPin}
              secureTextEntry
            />

            <AppButton title="Save PIN" onPress={handleSetPin} loading={isSubmitting} />
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
