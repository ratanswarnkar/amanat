import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

export default function AppLoader({ text = 'Loading...', fullScreen = false }) {
  return (
    <View style={[styles.container, fullScreen && styles.fullScreen]}>
      {/* Loading feedback UX:
          show progress clearly so users know the app is working and not frozen. */}
      <ActivityIndicator size="large" color={colors.primary} />
      {text ? <Text style={styles.text}>{text}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  fullScreen: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    backgroundColor: colors.overlay,
  },
  text: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm + spacing.xs,
  },
});
