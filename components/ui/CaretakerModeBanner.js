import { useContext } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AppButton from '../AppButton';
import { AuthContext } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

export default function CaretakerModeBanner() {
  const { activeMode, activePatientName, switchToOwner, user } = useContext(AuthContext);

  if (activeMode !== 'caretaker') {
    return null;
  }

  return (
    <View style={styles.banner}>
      <Text style={styles.title}>
        You are acting as caretaker for {activePatientName || 'this patient'}
      </Text>
      <AppButton
        title="Switch back to My Account"
        variant="secondary"
        size="small"
        onPress={() => switchToOwner(user?.id || null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardMuted,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  title: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
});
