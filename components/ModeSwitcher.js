import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import AppButton from './AppButton';
import AppCard from './ui/AppCard';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

export default function ModeSwitcher({
  activeMode,
  activePatientId,
  currentUserId,
  caretakerPatients = [],
  switchToOwner,
  switchToCaretaker,
  onModeChanged,
}) {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasCaretakerAccess = caretakerPatients.length > 0;
  const activePatient = useMemo(
    () => caretakerPatients.find((item) => String(item?.patient_id) === String(activePatientId)),
    [activePatientId, caretakerPatients]
  );

  const handleOwnerMode = async () => {
    setIsSubmitting(true);
    try {
      await switchToOwner(currentUserId);
      onModeChanged?.();
      Toast.show({ type: 'success', text1: 'Switched', text2: 'You are now using My Account mode.' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Failed', text2: error?.message || 'Could not switch mode.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenCaretaker = () => {
    if (!hasCaretakerAccess) {
      Toast.show({
        type: 'error',
        text1: 'Unavailable',
        text2: 'You are not assigned as a caretaker for any patient',
      });
      return;
    }

    setIsModalVisible(true);
  };

  const handleSelectPatient = async (patientId, patientName) => {
    setIsSubmitting(true);
    try {
      const switched = await switchToCaretaker(patientId);
      if (!switched) {
        Toast.show({ type: 'error', text1: 'Access denied', text2: 'Patient selection is no longer valid.' });
        return;
      }
      setIsModalVisible(false);
      onModeChanged?.();
      Toast.show({
        type: 'success',
        text1: 'Caretaker mode active',
        text2: `You are acting as caretaker for ${patientName || 'the selected patient'}.`,
      });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Failed', text2: error?.message || 'Could not switch mode.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppCard variant="outlined">
      <Text style={styles.sectionTitle}>Switch Mode</Text>
      <Text style={styles.helperText}>
        Current mode: {activeMode === 'caretaker'
          ? `Caretaker (${activePatient?.patient_name || 'Patient'})`
          : 'My Account'}
      </Text>

      <AppButton
        title="My Account"
        variant={activeMode === 'owner' ? 'primary' : 'secondary'}
        onPress={handleOwnerMode}
        disabled={isSubmitting}
      />
      <AppButton
        title="Caretaker Mode"
        variant={activeMode === 'caretaker' ? 'primary' : 'secondary'}
        onPress={handleOpenCaretaker}
        style={styles.modeButton}
        disabled={isSubmitting || !hasCaretakerAccess}
      />

      {!hasCaretakerAccess ? (
        <Text style={styles.helperText}>You are not assigned as a caretaker for any patient</Text>
      ) : null}

      <Modal
        transparent
        visible={isModalVisible}
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Patient</Text>
            <Text style={styles.modalSubtitle}>Choose which patient you want to assist.</Text>
            <ScrollView style={styles.list}>
              {caretakerPatients.map((item) => {
                const selected = String(item.patient_id) === String(activePatientId);
                return (
                  <Pressable
                    key={item.patient_id}
                    style={[styles.patientItem, selected && styles.patientItemSelected]}
                    onPress={() => handleSelectPatient(item.patient_id, item.patient_name)}
                  >
                    <View style={styles.patientContent}>
                      <Text style={styles.patientName}>{item.patient_name || 'Patient'}</Text>
                      <Text style={styles.patientMeta}>Status: {item.status || 'approved'}</Text>
                    </View>
                    <Text style={styles.selectText}>Select</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <AppButton
              title="Close"
              variant="secondary"
              onPress={() => setIsModalVisible(false)}
              disabled={isSubmitting}
            />
          </View>
        </View>
      </Modal>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    ...typography.headingMedium,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  helperText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  modeButton: {
    marginTop: spacing.sm,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    maxHeight: '75%',
  },
  modalTitle: {
    ...typography.headingMedium,
    color: colors.textPrimary,
  },
  modalSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  list: {
    marginBottom: spacing.md,
  },
  patientItem: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardMuted,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  patientItemSelected: {
    borderColor: colors.primary,
  },
  patientContent: {
    flex: 1,
    marginRight: spacing.sm,
  },
  patientName: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  patientMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  selectText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
});
