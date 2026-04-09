import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';
import AppButton from '../../components/AppButton';
import AppCard from '../../components/ui/AppCard';
import AppHeader from '../../components/ui/AppHeader';
import AppInput from '../../components/ui/AppInput';
import { sendVerification, verifyNominee } from '../../src/api/nominee';
import {
  getSecurityQuestionChallenge,
  verifySecurityQuestions,
} from '../../src/api/securityQuestions';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

export default function VerifyNomineeScreen() {
  const params = useLocalSearchParams();
  const nomineeId = String(params?.nomineeId || params?.nominee_id || '').trim();
  const nomineeName = String(params?.nomineeName || '').trim();

  const [otp, setOtp] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [step, setStep] = useState('otp');
  const [challenge, setChallenge] = useState([]);
  const [questionAnswers, setQuestionAnswers] = useState({});
  const [isLoadingChallenge, setIsLoadingChallenge] = useState(false);
  const [isSubmittingQuestions, setIsSubmittingQuestions] = useState(false);

  const triggerSendOtp = async (silent = false) => {
    if (!nomineeId) {
      if (!silent) {
        Toast.show({ type: 'error', text1: 'Invalid nominee', text2: 'Nominee ID is missing.' });
      }
      return;
    }

    try {
      setIsSendingOtp(true);
      const response = await sendVerification(nomineeId);
      if (!silent) {
        Toast.show({
          type: 'success',
          text1: 'OTP sent',
          text2: response?.message || 'OTP sent successfully.',
        });
      }
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Failed to send OTP.';
      if (!silent) {
        Toast.show({ type: 'error', text1: 'Send failed', text2: message });
      }
    } finally {
      setIsSendingOtp(false);
    }
  };

  useEffect(() => {
    triggerSendOtp(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nomineeId]);

  const loadChallenge = async () => {
    if (!nomineeId) {
      return;
    }

    try {
      setIsLoadingChallenge(true);
      const response = await getSecurityQuestionChallenge(nomineeId);
      setChallenge(Array.isArray(response?.questions) ? response.questions : []);
      setQuestionAnswers({});
      setStep('questions');
    } catch (error) {
      const message =
        error?.response?.data?.message || error?.message || 'Failed to load security questions.';
      Toast.show({ type: 'error', text1: 'Challenge failed', text2: message });
    } finally {
      setIsLoadingChallenge(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!nomineeId) {
      Toast.show({ type: 'error', text1: 'Invalid nominee', text2: 'Nominee ID is missing.' });
      return;
    }

    if (!/^\d{6}$/.test(otp.trim())) {
      Toast.show({ type: 'error', text1: 'Invalid OTP', text2: 'Enter a valid 6-digit OTP.' });
      return;
    }

    try {
      setIsVerifyingOtp(true);
      const response = await verifyNominee({
        nominee_id: nomineeId,
        otp: otp.trim(),
      });

      Toast.show({
        type: 'success',
        text1: 'OTP verified',
        text2: response?.message || 'Continue with security questions.',
      });
      setOtp('');
      await loadChallenge();
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Failed to verify nominee.';
      Toast.show({ type: 'error', text1: 'Verification failed', text2: message });
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleQuestionVerification = async () => {
    const answers = challenge.map((item) => ({
      question_key: item.question_key,
      answer: String(questionAnswers[item.question_key] || '').trim(),
    }));

    if (answers.some((item) => !item.answer)) {
      Toast.show({
        type: 'error',
        text1: 'Missing answers',
        text2: 'Please answer all 3 security questions.',
      });
      return;
    }

    try {
      setIsSubmittingQuestions(true);
      const response = await verifySecurityQuestions({
        nominee_id: nomineeId,
        answers,
      });

      Toast.show({
        type: 'success',
        text1: 'Verified',
        text2: response?.message || 'Nominee verified successfully.',
      });
      setQuestionAnswers({});
      setChallenge([]);
      setStep('otp');
      router.back();
    } catch (error) {
      const message =
        error?.response?.data?.message || error?.message || 'Failed to verify security questions.';
      Toast.show({ type: 'error', text1: 'Verification failed', text2: message });
    } finally {
      setIsSubmittingQuestions(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Verify Nominee" showBack />
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <AppCard variant="elevated" style={styles.card}>
            {step === 'otp' ? (
              <>
                <Text style={styles.title}>OTP Verification</Text>
                <Text style={styles.subtitle}>
                  {nomineeName ? `Verify ${nomineeName}` : 'Verify nominee access'} with a one-time password.
                </Text>

                <AppInput
                  label="OTP"
                  placeholder="123456"
                  keyboardType="number-pad"
                  value={otp}
                  onChangeText={setOtp}
                />

                <AppButton
                  title="Verify OTP"
                  onPress={handleVerifyOtp}
                  loading={isVerifyingOtp}
                  disabled={isVerifyingOtp || isSendingOtp}
                />

                <AppButton
                  title="Resend OTP"
                  variant="secondary"
                  onPress={() => triggerSendOtp(false)}
                  loading={isSendingOtp}
                  disabled={isSendingOtp || isVerifyingOtp}
                  style={styles.secondaryButton}
                />
              </>
            ) : (
              <>
                <Text style={styles.title}>Security Questions</Text>
                <Text style={styles.subtitle}>
                  Answer at least 2 of the 3 questions correctly to complete nominee verification.
                </Text>

                {challenge.map((item) => (
                  <AppInput
                    key={item.question_key}
                    label={item.prompt}
                    placeholder="Enter answer"
                    value={questionAnswers[item.question_key] || ''}
                    onChangeText={(text) =>
                      setQuestionAnswers((previous) => ({
                        ...previous,
                        [item.question_key]: text,
                      }))
                    }
                  />
                ))}

                <AppButton
                  title="Verify Security Questions"
                  onPress={handleQuestionVerification}
                  loading={isSubmittingQuestions}
                  disabled={isSubmittingQuestions || isLoadingChallenge}
                />

                <AppButton
                  title="Back to OTP"
                  variant="secondary"
                  onPress={() => setStep('otp')}
                  style={styles.secondaryButton}
                />
              </>
            )}
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
  secondaryButton: {
    marginTop: spacing.sm,
  },
});
