import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import AppCard from '../ui/AppCard';
import ScheduleForm from './ScheduleForm';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

export default function ScheduleEditorModal({
  visible,
  schedule,
  isSubmitting = false,
  onClose,
  onSubmit,
}) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={isSubmitting ? undefined : onClose}
    >
      <View style={styles.backdrop}>
        <AppCard variant="elevated" style={styles.modalCard}>
          <Text style={styles.title}>Edit Schedule</Text>
          <Text style={styles.subtitle}>Update medicine details, repeat type, and dose times.</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <ScheduleForm
              initialValues={{
                medicine_name: schedule?.medicine_name,
                dosage: schedule?.dosage,
                repeat_type: schedule?.repeat_type,
                times: Array.isArray(schedule?.time) ? schedule.time : [],
              }}
              submitLabel="Save Changes"
              submittingLabel="Saving Changes"
              onSubmit={onSubmit}
              onCancel={onClose}
              isSubmitting={isSubmitting}
              showCancel
            />
          </ScrollView>
        </AppCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    maxHeight: '82%',
    marginBottom: 0,
  },
  title: {
    ...typography.headingMedium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
});
