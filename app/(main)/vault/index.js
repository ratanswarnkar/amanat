import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import AppCard from '../../../components/ui/AppCard';
import AppHeader from '../../../components/ui/AppHeader';
import { colors } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';

function ActionCard({ icon, title, subtitle, onPress }) {
  return (
    <AppCard variant="elevated" style={styles.card} onPress={onPress}>
      <View style={styles.cardIconWrap}>
        <Ionicons name={icon} size={22} color={colors.primary} />
      </View>
      <View style={styles.cardTextWrap}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </AppCard>
  );
}

export default function VaultEntryScreen() {
  return (
    <View style={styles.container}>
      <AppHeader title="Amanat" showBack />

      <View style={styles.content}>
        <ActionCard
          icon="key-outline"
          title="Secure Vault Entries"
          subtitle="Passwords, bank info, and custom encrypted details."
          onPress={() => router.push('/amanat/credentials-vault')}
        />
        <ActionCard
          icon="folder-open-outline"
          title="My Vault Files"
          subtitle="Upload and organize your personal documents."
          onPress={() => router.push('/amanat/vault')}
        />
        <ActionCard
          icon="people-outline"
          title="Nominees"
          subtitle="Manage trusted family nominees and permissions."
          onPress={() => router.push('/nominees')}
        />
        <ActionCard
          icon="flash-outline"
          title="Emergency Access"
          subtitle="Review emergency authorization and status."
          onPress={() => router.push('/emergency')}
        />
      </View>
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  card: {
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTextWrap: {
    flex: 1,
    marginLeft: 12,
    marginRight: 10,
  },
  cardTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: 2,
  },
  cardSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
