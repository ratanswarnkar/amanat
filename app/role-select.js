import { useContext, useMemo } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import AppButton from '../components/AppButton';
import AppCard from '../components/ui/AppCard';
import AppHeader from '../components/ui/AppHeader';
import { AuthContext } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { getActiveRoleKeys, getRouteForSessionRole, hasMultipleActiveRoles } from '../src/utils/roleRouting';

export default function RoleSelectScreen() {
  const {
    token,
    roles,
    loginAsUser,
    loginAsNominee,
  } = useContext(AuthContext);

  const activeRoles = useMemo(() => getActiveRoleKeys(roles || {}), [roles]);

  if (!token) {
    return <Redirect href="/login" />;
  }

  if (activeRoles.length <= 1) {
    return <Redirect href="/(tabs)" />;
  }

  const continueAs = async (sessionRole) => {
    try {
      if (sessionRole === 'nominee') {
        await loginAsNominee();
      } else {
        await loginAsUser();
      }

      router.replace(getRouteForSessionRole(sessionRole));
    } catch (_error) {
      Alert.alert('Role selection fallback', 'Continuing to your user dashboard instead.');
      router.replace('/(tabs)');
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Choose Role" showBack />
      <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
          <AppCard variant="elevated" style={styles.card}>
            <Text style={styles.title}>Choose how you want to continue</Text>
            <Text style={styles.subtitle}>
              This account is linked to multiple Amanat roles. Pick the workspace you want for this session.
            </Text>

            <AppButton
              title="Continue as User"
              onPress={() => continueAs('user')}
              leftIcon="person-outline"
            />

            {roles?.nominee ? (
              <AppButton
                title="Continue as Nominee"
                onPress={() => continueAs('nominee')}
                variant="secondary"
                leftIcon="shield-checkmark-outline"
                style={styles.action}
              />
            ) : null}
            {hasMultipleActiveRoles(roles) ? (
              <Text style={styles.helperText}>
                You can switch roles again later by logging out and choosing a different session path.
              </Text>
            ) : null}
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
  action: {
    marginTop: spacing.sm,
  },
  helperText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
});
