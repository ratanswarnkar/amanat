import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

export default function AppButton({
  title,
  onPress,
  style,
  textStyle,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  leftIcon,
}) {
  // Visual hierarchy:
  // Variant controls importance (primary actions stand out, secondary/outline are lighter).
  const isDisabled = disabled || loading;
  const variantStyle = variantStyles[variant] || variantStyles.primary;
  const sizeStyle = sizeStyles[size] || sizeStyles.medium;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.baseButton,
        variantStyle.button,
        sizeStyle.button,
        isDisabled && styles.disabledButton,
        pressed && !isDisabled && styles.pressedButton,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
    >
      {/* Loading UX:
          show spinner and disable press so users do not trigger duplicate actions. */}
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variantStyle.spinnerColor}
          style={styles.loadingIndicator}
        />
      ) : null}
      {leftIcon && !loading ? (
        <Ionicons
          name={leftIcon}
          size={18}
          color={variantStyle.iconColor || variantStyle.text.color}
          style={styles.leftIcon}
        />
      ) : null}
      <Text style={[styles.baseText, variantStyle.text, sizeStyle.text, textStyle]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  baseButton: {
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  baseText: {
    ...typography.body,
    fontWeight: '600',
  },
  loadingIndicator: {
    marginRight: spacing.sm,
  },
  leftIcon: {
    marginRight: spacing.sm,
  },
  disabledButton: {
    opacity: 0.5,
  },
  pressedButton: {
    opacity: 0.85,
  },
});

const variantStyles = {
  primary: {
    button: {
      backgroundColor: colors.primaryStrong,
      borderColor: colors.primaryStrong,
    },
    text: {
      color: colors.textPrimary,
    },
    spinnerColor: colors.textPrimary,
    iconColor: colors.textPrimary,
  },
  secondary: {
    button: {
      backgroundColor: colors.secondary,
      borderColor: colors.borderStrong,
    },
    text: {
      color: colors.textPrimary,
    },
    spinnerColor: colors.textPrimary,
    iconColor: colors.primary,
  },
  outline: {
    button: {
      backgroundColor: colors.cardMuted,
      borderColor: colors.border,
    },
    text: {
      color: colors.textPrimary,
    },
    spinnerColor: colors.textPrimary,
    iconColor: colors.textPrimary,
  },
  danger: {
    button: {
      backgroundColor: colors.danger,
      borderColor: colors.danger,
    },
    text: {
      color: colors.background,
    },
    spinnerColor: colors.background,
    iconColor: colors.background,
  },
  ghost: {
    button: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      shadowOpacity: 0,
      elevation: 0,
    },
    text: {
      color: colors.textSecondary,
    },
    spinnerColor: colors.textSecondary,
    iconColor: colors.textSecondary,
  },
};

const sizeStyles = {
  small: {
    button: {
      paddingHorizontal: spacing.sm + spacing.xs,
      paddingVertical: spacing.sm - 1,
    },
    text: {
      fontSize: 14,
    },
  },
  medium: {
    button: {
      paddingHorizontal: spacing.lg,
      paddingVertical: 13,
    },
    text: {
      fontSize: 16,
    },
  },
  large: {
    button: {
      paddingHorizontal: spacing.xl,
      paddingVertical: 15,
    },
    text: {
      fontSize: 18,
    },
  },
};
