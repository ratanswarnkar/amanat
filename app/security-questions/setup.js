import { useContext, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import AppButton from '../../components/AppButton';
import AppCard from '../../components/ui/AppCard';
import AppHeader from '../../components/ui/AppHeader';
import AppInput from '../../components/ui/AppInput';
import { AuthContext } from '../../context/AuthContext';
import { saveSecurityQuestions } from '../../src/api/securityQuestions';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

const QUESTION_OPTIONS = [
  { question_key: 'first_school', prompt: 'What was the name of your first school?' },
  { question_key: 'childhood_friend', prompt: 'What is the first name of your childhood best friend?' },
  { question_key: 'mother_birth_city', prompt: 'In which city was your mother born?' },
  { question_key: 'first_pet', prompt: 'What was the name of your first pet?' },
  { question_key: 'favorite_teacher', prompt: 'What was the last name of your favorite teacher?' },
];

const MIN_SELECTED = 3;
const MAX_SELECTED = 5;

export default function SecurityQuestionsSetupScreen() {
  const { userRole, user, updateStoredUser } = useContext(AuthContext);
  const [selectedKeys, setSelectedKeys] = useState(QUESTION_OPTIONS.slice(0, 3).map((item) => item.question_key));
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedQuestions = useMemo(
    () => QUESTION_OPTIONS.filter((item) => selectedKeys.includes(item.question_key)),
    [selectedKeys]
  );

  if (userRole === 'nominee') {
    router.replace('/nominee-dashboard');
    return null;
  }

  if (userRole === null) {
    router.replace('/login');
    return null;
  }

  if (user?.hasSecurityQuestions) {
    router.replace('/dashboard');
    return null;
  }

  const toggleQuestion = (questionKey) => {
    setSelectedKeys((previous) => {
      const isSelected = previous.includes(questionKey);

      if (isSelected) {
        if (previous.length <= MIN_SELECTED) {
          Toast.show({
            type: 'error',
            text1: 'Minimum required',
            text2: 'Please keep at least 3 security questions selected.',
          });
          return previous;
        }
        return previous.filter((item) => item !== questionKey);
      }

      if (previous.length >= MAX_SELECTED) {
        Toast.show({
          type: 'error',
          text1: 'Maximum reached',
          text2: 'You can select up to 5 security questions.',
        });
        return previous;
      }

      return [...previous, questionKey];
    });
  };

  const handleSubmit = async () => {
    if (selectedKeys.length < MIN_SELECTED || selectedKeys.length > MAX_SELECTED) {
      Toast.show({
        type: 'error',
        text1: 'Selection invalid',
        text2: 'Select between 3 and 5 security questions.',
      });
      return;
    }

    const payload = selectedQuestions.map((question) => ({
      question_key: question.question_key,
      answer: String(answers[question.question_key] || '').trim(),
    }));

    if (payload.some((item) => !item.answer)) {
      Toast.show({
        type: 'error',
        text1: 'Missing answers',
        text2: 'Every selected question needs an answer.',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await saveSecurityQuestions(payload);
      await updateStoredUser({ hasSecurityQuestions: true });
      Toast.show({
        type: 'success',
        text1: 'Saved',
        text2: 'Security questions saved successfully.',
      });
      router.replace('/dashboard');
    } catch (error) {
      const message =
        error?.response?.data?.message || error?.message || 'Failed to save security questions.';
      Toast.show({
        type: 'error',
        text1: 'Save failed',
        text2: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Security Questions" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppCard variant="elevated" style={styles.heroCard}>
          <Text style={styles.title}>Set your recovery questions</Text>
          <Text style={styles.subtitle}>
            Choose 3 to 5 questions. These will be used to verify nominee access later.
          </Text>
        </AppCard>

        <AppCard variant="outlined" style={styles.selectionCard}>
          <Text style={styles.sectionTitle}>Choose your questions</Text>
          <Text style={styles.sectionText}>{selectedKeys.length} selected</Text>

          <View style={styles.chipWrap}>
            {QUESTION_OPTIONS.map((question) => {
              const isSelected = selectedKeys.includes(question.question_key);
              return (
                <Pressable
                  key={question.question_key}
                  onPress={() => toggleQuestion(question.question_key)}
                  style={[styles.chip, isSelected && styles.chipActive]}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                    {question.prompt}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </AppCard>

        <AppCard variant="elevated" style={styles.answersCard}>
          <Text style={styles.sectionTitle}>Your answers</Text>
          {selectedQuestions.map((question) => (
            <AppInput
              key={question.question_key}
              label={question.prompt}
              placeholder="Enter your answer"
              value={answers[question.question_key] || ''}
              onChangeText={(text) =>
                setAnswers((previous) => ({
                  ...previous,
                  [question.question_key]: text,
                }))
              }
            />
          ))}

          <AppButton
            title="Save Security Questions"
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting}
          />
        </AppCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  heroCard: {
    borderRadius: 20,
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
    lineHeight: 22,
  },
  selectionCard: {
    marginBottom: spacing.md,
  },
  answersCard: {
    borderRadius: 20,
  },
  sectionTitle: {
    ...typography.headingMedium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  sectionText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  chipWrap: {
    gap: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.cardMuted,
  },
  chipActive: {
    borderColor: colors.primaryStrong,
    backgroundColor: colors.secondary,
  },
  chipText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  chipTextActive: {
    fontWeight: '700',
  },
});
