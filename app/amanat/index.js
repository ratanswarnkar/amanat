import { router, useRootNavigationState } from 'expo-router';
import { useContext, useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import AppCard from '../../components/ui/AppCard';
import AppHeader from '../../components/ui/AppHeader';
import { AuthContext } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

export default function AmanatHomeScreen() {
  const { userRole } = useContext(AuthContext);
  const navState = useRootNavigationState();

  useEffect(() => {
    // Wait for root router readiness before auto-redirecting from effects.
    if (!navState?.key) return;

    if (userRole === 'nominee') {
      router.replace('/nominee-dashboard');
      return;
    }

    if (userRole === null) {
      router.replace('/login');
    }
  }, [userRole, navState]);

  return (
    <View style={styles.container}>
      <AppHeader title="Amanat" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <AppCard style={styles.heroCard}>
          <Text style={styles.heading}>Vault Controls</Text>
          <Text style={styles.subtitle}>Every Amanat tool now shares the same premium vault styling.</Text>
        </AppCard>

        <AppCard
          title="Vault Files"
          subtitle="Store and manage important files"
          onPress={() => router.push('/amanat/vault')}
        />

        <AppCard
          title="Nominees"
          subtitle="View nominee details"
          onPress={() => router.push('/nominees')}
        />

        <AppCard
          title="Life Confirmation"
          subtitle="Set 7-day activity reminders"
          onPress={() => router.push('/life')}
        />

        <AppCard
          title="Emergency Access"
          subtitle="See nominees with emergency access"
          onPress={() => router.push('/emergency')}
        />
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
    paddingTop: spacing.md,
  },
  heroCard: {
    marginBottom: spacing.md,
  },
  heading: {
    ...typography.headingLarge,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
