import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

const toDisplayName = (user) => {
  const resolved = String(user?.name || user?.full_name || '').trim();
  return resolved || 'Profile';
};

const toInitials = (user) => {
  const displayName = toDisplayName(user);
  const parts = displayName.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || '').join('') || 'P';
};

export default function ProfileBadge({ user, onPress, light = false }) {
  const displayName = toDisplayName(user);
  const subtitle = user?.email ? String(user.email).trim() : String(user?.phone || user?.mobile || '').trim();
  const textColor = light ? '#F8FBFF' : colors.textPrimary;
  const mutedColor = light ? 'rgba(224,231,255,0.82)' : colors.textSecondary;
  const borderColor = light ? 'rgba(255,255,255,0.18)' : colors.border;
  const backgroundColor = light ? 'rgba(255,255,255,0.10)' : colors.cardMuted;

  const content = (
    <View style={[styles.container, { borderColor, backgroundColor }]}>
      <View style={[styles.avatar, { borderColor, backgroundColor: light ? 'rgba(255,255,255,0.18)' : colors.card }]}>
        <Text style={[styles.avatarText, { color: textColor }]}>{toInitials(user)}</Text>
      </View>
      <View style={styles.copy}>
        <Text style={[styles.name, { color: textColor }]} numberOfLines={1}>
          {displayName}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: mutedColor }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    maxWidth: 190,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    borderRadius: 16,
    borderWidth: 1,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: spacing.sm,
  },
  avatarText: {
    ...typography.caption,
    fontWeight: '800',
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    ...typography.caption,
    fontWeight: '800',
  },
  subtitle: {
    ...typography.caption,
    fontSize: 12,
  },
  pressed: {
    opacity: 0.86,
  },
});
