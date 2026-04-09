import { useContext, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { router, useLocalSearchParams } from 'expo-router';
import AppButton from '../../components/AppButton';
import AppCard from '../../components/ui/AppCard';
import AppHeader from '../../components/ui/AppHeader';
import AppInput from '../../components/ui/AppInput';
import { AuthContext } from '../../context/AuthContext';
import { loginWithPin } from '../../src/api/auth';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

export default function LoginScreen() {
  const params = useLocalSearchParams();
  const { mobile: storedMobile, token, setSession } = useContext(AuthContext);
  const [mobile, setMobile] = useState(String(params.mobile || storedMobile || ''));
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBiometric, setShowBiometric] = useState(false);

  useEffect(() => {
    const checkBiometric = async () => {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setShowBiometric(Boolean(hasHardware && isEnrolled));
    };

    checkBiometric().catch(() => setShowBiometric(false));
  }, []);

  const handleLogin = async () => {
    if (!/^\d{10}$/.test(mobile)) {
      Alert.alert('Invalid mobile', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      Alert.alert('Invalid PIN', 'PIN must be exactly 4 digits.');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await loginWithPin({ mobile, pin });
      await setSession({
        token: response.token,
        refreshToken: response.refreshToken,
        mobile,
        user: response.user || null,
        roles: response.roles || null,
      });
      if (response?.user?.hasSecurityQuestions === false) {
        router.replace('/security-questions/setup');
        return;
      }

      if (response?.roles?.nominee) {
        router.replace('/role-select');
        return;
      }

      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Login failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBiometric = async () => {
    if (!token) {
      Alert.alert('Login with PIN', 'Biometric login becomes available after a successful PIN login on this device.');
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Amanat',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });

    if (!result.success) {
      Alert.alert('Authentication failed', 'Please login with PIN.');
      return;
    }

    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Login" showBack />
      <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
          <AppCard variant="elevated" style={styles.card}>
            <Text style={styles.title}>Login with PIN</Text>
            <Text style={styles.subtitle}>Use your registered mobile number and 4-digit PIN.</Text>

            <AppInput
              label="Mobile Number"
              placeholder="9876543210"
              keyboardType="number-pad"
              value={mobile}
              onChangeText={setMobile}
            />

            <AppInput
              label="4-digit PIN"
              placeholder="1234"
              keyboardType="number-pad"
              value={pin}
              onChangeText={setPin}
              secureTextEntry
            />

            <AppButton title="Login with PIN" onPress={handleLogin} loading={isSubmitting} />
            {showBiometric ? (
              <AppButton
                title="Login with Fingerprint"
                onPress={handleBiometric}
                variant="secondary"
                style={styles.secondaryButton}
              />
            ) : null}
            <AppButton
              title="Forgot PIN"
              onPress={() => router.push({ pathname: '/forgot-pin', params: { mobile } })}
              variant="ghost"
              style={styles.secondaryButton}
            />
            <AppButton
              title="Nominee Access"
              onPress={() => router.push('/nominee-access-login')}
              variant="ghost"
              style={styles.secondaryButton}
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
  secondaryButton: {
    marginTop: spacing.sm,
  },
});
