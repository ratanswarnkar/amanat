import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

export default function AppHeader({
  title,
  showBack = false,
  onBackPress,
  rightIcon,
  onRightPress,
  rightContent,
}) {
  const router = useRouter();

  const handleBack = () => {
    // Navigation handling: by default we use router.back() so this header works on any screen.
    if (onBackPress) {
      onBackPress();
      return;
    }
    router.back();
  };

  return (
    <View style={styles.container}>
      {/* Reusable structure: left action, centered title, right action. */}
      <View style={styles.sideSlot}>
        {showBack ? (
          <Pressable onPress={handleBack} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      <View style={styles.sideSlot}>
        {rightContent ? rightContent : null}
        {!rightContent && rightIcon && onRightPress ? (
          <Pressable onPress={onRightPress} style={styles.iconButton}>
            <Ionicons name={rightIcon} size={20} color={colors.textPrimary} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 64,
    backgroundColor: colors.backgroundAlt,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  sideSlot: {
    minWidth: 44,
    maxWidth: 192,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    ...typography.headingMedium,
    fontSize: 22,
    color: colors.textPrimary,
  },
});
