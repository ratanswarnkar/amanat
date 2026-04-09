import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

export default function AppCard({ children, style, onPress, variant = 'default', title, subtitle }) {
  const cardStyles = [styles.base, styles[variant] || styles.default, style];
  const content = (
    <>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {children}
    </>
  );

  // Reusable UI component:
  // Use Pressable only when onPress is provided, otherwise use a simple View.
  if (onPress) {
    return (
      <Pressable style={cardStyles} onPress={onPress}>
        {content}
      </Pressable>
    );
  }

  return <View style={cardStyles}>{content}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 18,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 8,
  },
  default: {
    backgroundColor: colors.card,
  },
  outlined: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.cardMuted,
  },
  elevated: {
    backgroundColor: colors.cardElevated,
    borderColor: colors.borderStrong,
  },
  title: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
