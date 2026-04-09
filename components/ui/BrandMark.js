import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

const brandIcon = require('../../assets/images/icon.png');

export default function BrandMark({ label = 'Amanat', compact = false, light = false }) {
  const textColor = light ? '#F8FBFF' : colors.textPrimary;
  const borderColor = light ? 'rgba(255,255,255,0.16)' : colors.border;
  const backgroundColor = light ? 'rgba(255,255,255,0.12)' : colors.cardMuted;

  return (
    <View style={styles.row}>
      <View style={[styles.iconWrap, compact && styles.iconWrapCompact, { borderColor, backgroundColor }]}>
        <Image source={brandIcon} style={[styles.icon, compact && styles.iconCompact]} resizeMode="contain" />
        <View style={styles.iconFallback}>
          <Ionicons name="shield-half-outline" size={compact ? 16 : 18} color={textColor} />
        </View>
      </View>
      {label ? (
        <Text style={[styles.label, compact && styles.labelCompact, { color: textColor }]} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
    marginRight: spacing.sm + 4,
  },
  iconWrapCompact: {
    width: 34,
    height: 34,
    borderRadius: 12,
    marginRight: spacing.sm,
  },
  icon: {
    width: 26,
    height: 26,
  },
  iconCompact: {
    width: 22,
    height: 22,
  },
  iconFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0,
  },
  label: {
    ...typography.body,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  labelCompact: {
    fontSize: 18,
  },
});
