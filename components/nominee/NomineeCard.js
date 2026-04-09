import { StyleSheet, Text, View } from 'react-native';
import AppButton from '../AppButton';
import AppCard from '../ui/AppCard';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

const resolveStatus = (nominee) => {
  if (nominee?.is_verified === true) {
    return 'verified';
  }

  const raw = String(nominee?.verification_status || '').toLowerCase();
  return raw === 'approved' ? 'verified' : 'pending';
};

export default function NomineeCard({ nominee, onVerify, onDelete, isVerifying, isDeleting }) {
  const status = resolveStatus(nominee);
  const isVerified = status === 'verified';

  return (
    <AppCard variant="elevated" style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.name}>{nominee?.name || 'Nominee'}</Text>
        <View style={[styles.badge, isVerified ? styles.verifiedBadge : styles.pendingBadge]}>
          <Text style={[styles.badgeText, isVerified ? styles.verifiedText : styles.pendingText]}>
            {isVerified ? 'Verified' : 'Pending'}
          </Text>
        </View>
      </View>

      <Text style={styles.meta}>Phone: {nominee?.phone || '--'}</Text>
      <Text style={styles.meta}>Relationship: {nominee?.relationship || '--'}</Text>

      <View style={styles.actions}>
        {!isVerified ? (
          <AppButton
            title="Verify"
            size="small"
            variant="secondary"
            onPress={onVerify}
            loading={isVerifying}
            disabled={isDeleting}
          />
        ) : null}

        <AppButton
          title="Delete"
          size="small"
          variant="danger"
          onPress={onDelete}
          loading={isDeleting}
          disabled={isVerifying}
        />
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  name: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    flex: 1,
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  badge: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm + 2,
  },
  badgeText: {
    ...typography.caption,
    fontWeight: '700',
  },
  verifiedBadge: {
    backgroundColor: colors.secondary,
  },
  pendingBadge: {
    backgroundColor: colors.cardMuted,
  },
  verifiedText: {
    color: colors.success,
  },
  pendingText: {
    color: colors.warning,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
