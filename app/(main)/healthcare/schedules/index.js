import { useCallback, useContext, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AppButton from '../../../../components/AppButton';
import ScheduleEditorModal from '../../../../components/healthcare/ScheduleEditorModal';
import ScheduleForm from '../../../../components/healthcare/ScheduleForm';
import AppCard from '../../../../components/ui/AppCard';
import AppHeader from '../../../../components/ui/AppHeader';
import CaretakerModeBanner from '../../../../components/ui/CaretakerModeBanner';
import EmptyState from '../../../../components/ui/EmptyState';
import { AuthContext } from '../../../../context/AuthContext';
import {
  createSchedule,
  deleteSchedule,
  getSchedules,
  updateSchedule,
} from '../../../../src/api/healthcare';
import { colors } from '../../../../theme/colors';
import { spacing } from '../../../../theme/spacing';
import { typography } from '../../../../theme/typography';

export default function SchedulesScreen() {
  const { activePatientId } = useContext(AuthContext);
  const [schedules, setSchedules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);

  const loadSchedules = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      const data = await getSchedules();
      setSchedules(Array.isArray(data) ? data : []);
    } catch (error) {
      Alert.alert('Load failed', error?.response?.data?.message || error?.message || 'Unable to load schedules.');
      setSchedules([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  const handleCreateSchedule = async (values) => {
    try {
      setIsCreating(true);
      await createSchedule({
        ...values,
        patient_id: activePatientId,
      });
      await loadSchedules(true);
      Alert.alert('Saved', 'Schedule created successfully.');
    } catch (error) {
      Alert.alert('Save failed', error?.response?.data?.message || error?.message || 'Failed to create schedule.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateSchedule = async (values) => {
    if (!editingSchedule?.id) {
      return;
    }

    try {
      setIsUpdating(true);
      await updateSchedule(editingSchedule.id, {
        ...values,
        patient_id: activePatientId,
      });
      await loadSchedules(true);
      setEditingSchedule(null);
      Alert.alert('Updated', 'Schedule updated successfully.');
    } catch (error) {
      Alert.alert('Update failed', error?.response?.data?.message || error?.message || 'Failed to update schedule.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    try {
      await deleteSchedule(scheduleId);
      await loadSchedules(true);
    } catch (error) {
      Alert.alert('Delete failed', error?.response?.data?.message || error?.message || 'Could not delete schedule.');
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Schedules" showBack />
      <View style={styles.content}>
        <CaretakerModeBanner />
        <AppCard variant="elevated" style={styles.formCard}>
          <Text style={styles.formTitle}>Create Schedule</Text>
          <ScheduleForm
            initialValues={{
              medicine_name: '',
              dosage: '',
              repeat_type: 'daily',
              times: [],
            }}
            submitLabel="Save Schedule"
            submittingLabel="Saving Schedule"
            onSubmit={handleCreateSchedule}
            isSubmitting={isCreating}
          />
        </AppCard>

        <FlatList
          data={schedules}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadSchedules(true)} />}
          contentContainerStyle={schedules.length === 0 ? styles.emptyContent : styles.listContent}
          ListEmptyComponent={
            !isLoading ? (
              <EmptyState
                icon="time-outline"
                title="No schedules yet"
                message="Create your first medicine schedule to auto-generate reminders."
              />
            ) : null
          }
          renderItem={({ item }) => (
            <AppCard variant="outlined" style={styles.itemCard}>
              <Text style={styles.itemTitle}>{item.medicine_name}</Text>
              <Text style={styles.itemMeta}>Dosage: {item.dosage || '--'}</Text>
              <Text style={styles.itemMeta}>Repeat: {item.repeat_type}</Text>
              <Text style={styles.itemMeta}>
                Times: {(Array.isArray(item.time) ? item.time : []).map((value) => value.slice(0, 5)).join(', ') || '--'}
              </Text>
              <View style={styles.itemActions}>
                <AppButton
                  title="Edit"
                  size="small"
                  variant="outline"
                  onPress={() => setEditingSchedule(item)}
                />
                <AppButton
                  title="Delete"
                  size="small"
                  variant="secondary"
                  onPress={() => handleDeleteSchedule(item.id)}
                  style={styles.deleteButton}
                />
              </View>
            </AppCard>
          )}
        />
        <ScheduleEditorModal
          visible={Boolean(editingSchedule)}
          schedule={editingSchedule}
          isSubmitting={isUpdating}
          onClose={() => {
            if (!isUpdating) {
              setEditingSchedule(null);
            }
          }}
          onSubmit={handleUpdateSchedule}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  formCard: {
    marginBottom: spacing.md,
  },
  formTitle: {
    ...typography.headingMedium,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  itemCard: {
    marginBottom: spacing.sm,
  },
  itemTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  itemMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  itemActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  deleteButton: {
    marginTop: 0,
  },
});
