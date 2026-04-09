import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import AppButton from '../AppButton';
import AppCard from './AppCard';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

export default function EmptyState({
  title,
  message,
  buttonText,
  onButtonPress,
  icon = 'folder-open-outline',
}) {
  return (
    <AppCard variant="outlined" style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={24} color={colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>

      {buttonText && onButtonPress ? (
        <AppButton title={buttonText} onPress={onButtonPress} variant="secondary" size="small" />
      ) : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.headingMedium,
    fontSize: 22,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.md,
  },
});
