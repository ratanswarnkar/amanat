import { useContext, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import AppButton from '../components/AppButton';
import AppCard from '../components/ui/AppCard';
import AppHeader from '../components/ui/AppHeader';
import AppInput from '../components/ui/AppInput';
import { AuthContext } from '../context/AuthContext';
import {
  loadNomineeAccessChallenge,
  sendNomineeAccessOtp,
  verifyNomineeAccessOtp,
  verifyNomineeAccessSecurity,
} from '../src/api/nomineeAccess';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

const normalizePhone = (value = '') => value.replace(/\D/g, '').slice(-10);

const initialAnswerState = {
  answer0: '',
  answer1: '',
  answer2: '',
};

export default function NomineeAccessLoginScreen() {
  const { setSession } = useContext(AuthContext);
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const [linkedNominees, setLinkedNominees] = useState([]);
  const [selectedNomineeId, setSelectedNomineeId] = useState('');
  const [selectedOwnerName, setSelectedOwnerName] = useState('');
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState(initialAnswerState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetChallengeState = () => {
    setSelectedNomineeId('');
    setSelectedOwnerName('');
    setQuestions([]);
    setAnswers(initialAnswerState);
  };

  const handleSendOtp = async () => {
    const cleanedPhone = normalizePhone(phone);
    if (!/^\d{10}$/.test(cleanedPhone)) {
      Toast.show({ type: 'error', text1: 'Invalid phone', text2: 'Enter a valid 10-digit nominee phone.' });
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await sendNomineeAccessOtp({ phone: cleanedPhone });
      setPhone(cleanedPhone);
      setStep('otp');
      Toast.show({
        type: 'success',
        text1: 'OTP sent',
        text2: response?.message || 'We sent an OTP to the nominee account phone.',
      });
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Failed to send OTP.';
      Toast.show({ type: 'error', text1: 'OTP failed', text2: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async () => {
    const cleanedPhone = normalizePhone(phone);
    if (!/^\d{10}$/.test(cleanedPhone)) {
      Toast.show({ type: 'error', text1: 'Invalid phone', text2: 'Enter a valid 10-digit nominee phone.' });
      return;
    }

    if (!/^\d{6}$/.test(String(otp || '').trim())) {
      Toast.show({ type: 'error', text1: 'Invalid OTP', text2: 'Enter the 6-digit OTP.' });
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await verifyNomineeAccessOtp({
        phone: cleanedPhone,
        otp: String(otp).trim(),
      });

      const nominees = Array.isArray(response?.nominees) ? response.nominees : [];
      setChallengeToken(response?.challenge_token || '');
      setLinkedNominees(nominees);
      resetChallengeState();

      if (nominees.length === 1) {
        setSelectedNomineeId(String(nominees[0].nominee_id || ''));
        setSelectedOwnerName(String(nominees[0].owner_name || ''));
      }

      setStep('nominee');
      Toast.show({
        type: 'success',
        text1: 'OTP verified',
        text2: response?.message || 'Select the owner vault you need to unlock.',
      });
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Failed to verify OTP.';
      Toast.show({ type: 'error', text1: 'Verification failed', text2: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLoadQuestions = async () => {
    if (!challengeToken) {
      Toast.show({ type: 'error', text1: 'Session expired', text2: 'Verify OTP again to continue.' });
      return;
    }

    if (!selectedNomineeId) {
      Toast.show({ type: 'error', text1: 'Select owner', text2: 'Choose the linked owner access first.' });
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await loadNomineeAccessChallenge({
        challenge_token: challengeToken,
        nominee_id: selectedNomineeId,
      });

      const nextQuestions = Array.isArray(response?.questions) ? response.questions : [];
      setSelectedOwnerName(response?.owner_name || selectedOwnerName);
      setQuestions(nextQuestions);
      setAnswers(initialAnswerState);
      setStep('questions');

      Toast.show({
        type: 'success',
        text1: 'Questions ready',
        text2: 'Answer at least 2 of 3 correctly to unlock read-only access.',
      });
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Failed to load owner questions.';
      Toast.show({ type: 'error', text1: 'Challenge failed', text2: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyQuestions = async () => {
    if (!challengeToken || !selectedNomineeId || questions.length !== 3) {
      Toast.show({ type: 'error', text1: 'Challenge missing', text2: 'Reload the owner security questions.' });
      return;
    }

    const payload = questions.map((question, index) => ({
      question_key: question.question_key,
      answer: answers[`answer${index}`]?.trim() || '',
    }));

    if (payload.some((item) => !item.answer)) {
      Toast.show({ type: 'error', text1: 'Missing answers', text2: 'Answer all 3 security questions.' });
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await verifyNomineeAccessSecurity({
        challenge_token: challengeToken,
        nominee_id: selectedNomineeId,
        answers: payload,
      });

      await setSession({
        token: response?.token,
        refreshToken: null,
        mobile: normalizePhone(phone),
        user: response?.user || null,
        roles: {
          owner: false,
          nominee: true,
        },
      });

      Toast.show({
        type: 'success',
        text1: 'Access granted',
        text2: response?.message || 'Read-only nominee session started.',
      });
      router.replace('/nominee-dashboard');
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Failed to verify owner security questions.';
      Toast.show({ type: 'error', text1: 'Verification failed', text2: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderPhoneStep = () => (
    <AppCard variant="elevated" style={styles.card}>
      <Text style={styles.title}>Nominee emergency login</Text>
      <Text style={styles.subtitle}>
        Sign in with the nominee account phone. Amanat will match it to approved nominee records.
      </Text>

      <AppInput
        label="Nominee Phone"
        placeholder="9876543210"
        keyboardType="number-pad"
        value={phone}
        onChangeText={setPhone}
      />

      <AppButton title="Send OTP" onPress={handleSendOtp} loading={isSubmitting} />
    </AppCard>
  );

  const renderOtpStep = () => (
    <AppCard variant="elevated" style={styles.card}>
      <Text style={styles.title}>Verify nominee account</Text>
      <Text style={styles.subtitle}>
        Enter the OTP sent to {normalizePhone(phone)}. Owner PINs and passwords are never shared in this flow.
      </Text>

      <AppInput
        label="OTP"
        placeholder="123456"
        keyboardType="number-pad"
        value={otp}
        onChangeText={setOtp}
      />

      <AppButton title="Verify OTP" onPress={handleVerifyOtp} loading={isSubmitting} />
      <AppButton title="Change Phone" onPress={() => setStep('phone')} variant="ghost" />
    </AppCard>
  );

  const renderNomineeOption = (item) => {
    const isSelected = selectedNomineeId === String(item?.nominee_id || '');
    const isReady = item?.emergency_active && item?.has_security_questions;

    return (
      <Pressable
        key={String(item?.nominee_id || '')}
        onPress={() => {
          setSelectedNomineeId(String(item?.nominee_id || ''));
          setSelectedOwnerName(String(item?.owner_name || ''));
        }}
        style={[styles.optionCard, isSelected && styles.optionCardSelected]}
      >
        <Text style={styles.optionTitle}>{item?.owner_name || 'Account holder'}</Text>
        <Text style={styles.optionSubtitle}>
          Nominee link: {item?.nominee_name || 'Nominee'} {item?.relationship ? `| ${item.relationship}` : ''}
        </Text>
        <Text style={styles.optionMeta}>
          {item?.emergency_active
            ? 'Emergency active'
            : 'Emergency not active yet'}
        </Text>
        <Text style={styles.optionMeta}>
          {item?.has_security_questions
            ? 'Owner security questions configured'
            : 'Owner security questions missing'}
        </Text>
        <Text style={[styles.optionBadge, isReady ? styles.optionReady : styles.optionBlocked]}>
          {isReady ? 'Eligible for challenge' : 'Not ready'}
        </Text>
      </Pressable>
    );
  };

  const renderNomineeStep = () => (
    <AppCard variant="elevated" style={styles.card}>
      <Text style={styles.title}>Choose linked owner</Text>
      <Text style={styles.subtitle}>
        Your nominee account can only continue with owner links that already exist in the backend.
      </Text>

      <View style={styles.optionsWrapper}>{linkedNominees.map(renderNomineeOption)}</View>

      <AppButton title="Continue to Security Questions" onPress={handleLoadQuestions} loading={isSubmitting} />
      <AppButton title="Back to OTP" onPress={() => setStep('otp')} variant="ghost" />
    </AppCard>
  );

  const renderQuestionStep = () => (
    <AppCard variant="elevated" style={styles.card}>
      <Text style={styles.title}>Answer owner questions</Text>
      <Text style={styles.subtitle}>
        Answer {selectedOwnerName || 'the owner'}&apos;s security questions. At least 2 of 3 must be correct.
      </Text>

      {questions.map((question, index) => (
        <AppInput
          key={question.question_key}
          label={question.prompt}
          placeholder="Type your answer"
          value={answers[`answer${index}`]}
          onChangeText={(value) =>
            setAnswers((previous) => ({
              ...previous,
              [`answer${index}`]: value,
            }))
          }
        />
      ))}

      <AppButton title="Unlock Read-Only Access" onPress={handleVerifyQuestions} loading={isSubmitting} />
      <AppButton title="Choose Different Owner" onPress={() => setStep('nominee')} variant="ghost" />
    </AppCard>
  );

  const renderStep = () => {
    if (step === 'otp') return renderOtpStep();
    if (step === 'nominee') return renderNomineeStep();
    if (step === 'questions') return renderQuestionStep();
    return renderPhoneStep();
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Nominee Access" showBack />
      <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
          {renderStep()}
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
  optionsWrapper: {
    marginBottom: spacing.md,
  },
  optionCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.cardMuted,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  optionCardSelected: {
    borderColor: colors.primaryStrong,
  },
  optionTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  optionSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  optionMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  optionBadge: {
    ...typography.caption,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  optionReady: {
    color: colors.success,
  },
  optionBlocked: {
    color: colors.danger,
  },
});
