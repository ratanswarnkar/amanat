import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import AppButton from '../../../../components/AppButton';
import AppCard from '../../../../components/ui/AppCard';
import AppHeader from '../../../../components/ui/AppHeader';
import AppInput from '../../../../components/ui/AppInput';
import CaretakerModeBanner from '../../../../components/ui/CaretakerModeBanner';
import EmptyState from '../../../../components/ui/EmptyState';
import {
  completeReminder,
  createReminder,
  getMedicines,
  getNotificationHistory,
  getReminders,
} from '../../../../src/api/healthcare';
import { colors } from '../../../../theme/colors';
import { spacing } from '../../../../theme/spacing';
import { typography } from '../../../../theme/typography';

export default function RemindersScreen() {
  const [reminders, setReminders] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [selectedMedicineId, setSelectedMedicineId] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completingReminderId, setCompletingReminderId] = useState('');

  const loadReminders = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }

      const [reminderData, medicineData, historyData] = await Promise.all([
        getReminders(),
        getMedicines(),
        getNotificationHistory(),
      ]);

      setReminders(reminderData);
      setMedicines(medicineData);
      setHistory(historyData);

      if (!selectedMedicineId && medicineData.length > 0) {
        setSelectedMedicineId(medicineData[0].id);
      }
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Unable to load reminders.';
      Alert.alert('Load failed', message);
      setReminders([]);
      setMedicines([]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedMedicineId]);

  useEffect(() => {
    loadReminders();

    return () => {
      Speech.stop();
    };
  }, [loadReminders]);

  const handleAddReminder = async () => {
    if (!selectedMedicineId) {
      Alert.alert('Missing medicine', 'Add a medicine first from Medicine Tracker.');
      return;
    }

    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(reminderTime.trim())) {
      Alert.alert('Invalid time', 'Reminder time must be in HH:MM format. Example: 08:30');
      return;
    }

    try {
      setIsSubmitting(true);
      const selectedMedicine = medicines.find((medicine) => medicine.id === selectedMedicineId);
      await createReminder({
        medicine_id: selectedMedicineId,
        medicineName: selectedMedicine?.name,
        time: reminderTime.trim(),
      });
      setReminderTime('');
      await loadReminders(true);
      Alert.alert('Reminder added', 'Reminder created successfully.');
    } catch (error) {
      console.log('[Reminder Create Error]', error?.response?.data || error?.message);
      const message = error?.response?.data?.message || error?.message || 'Failed to create reminder.';
      Alert.alert('Add failed', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTriggerReminder = (item) => {
    const message = `Reminder: Take ${item.name} at ${item.reminder_time}`;
    Speech.stop();
    Speech.speak(message, { language: 'en-US', pitch: 1, rate: 0.95 });
    console.log('[Reminder Triggered]', {
      reminderId: item.id,
      medicine: item.name,
      time: item.reminder_time,
      triggeredAt: new Date().toISOString(),
    });
    Alert.alert('Reminder triggered', `${item.name} at ${item.reminder_time}`);
  };

  const handleCompleteReminder = async (item) => {
    try {
      setCompletingReminderId(String(item.id));
      await completeReminder(item.id);
      await loadReminders(true);
      Alert.alert('Done', 'Reminder marked as completed.');
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Failed to complete reminder.';
      Alert.alert('Action failed', message);
    } finally {
      setCompletingReminderId('');
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Reminders" />
      <View style={styles.content}>
        <CaretakerModeBanner />
        <AppCard variant="elevated" style={styles.formCard}>
          <Text style={styles.formTitle}>Add Reminder</Text>
          <Text style={styles.formHint}>Select a medicine and set time in HH:MM format.</Text>

          {medicines.length > 0 ? (
            <View style={styles.medicineChips}>
              {medicines.map((medicine) => {
                const selected = selectedMedicineId === medicine.id;
                return (
                  <AppButton
                    key={medicine.id}
                    title={medicine.name}
                    size="small"
                    variant={selected ? 'primary' : 'outline'}
                    onPress={() => setSelectedMedicineId(medicine.id)}
                  />
                );
              })}
            </View>
          ) : (
            <Text style={styles.noMedicine}>No medicines found. Add one in Medicine Tracker first.</Text>
          )}

          <AppInput
            label="Reminder Time"
            placeholder="08:30"
            value={reminderTime}
            onChangeText={setReminderTime}
          />
          <AppButton
            title="Add Reminder"
            onPress={handleAddReminder}
            loading={isSubmitting}
            disabled={isSubmitting || medicines.length === 0}
          />
        </AppCard>

        <FlatList
          data={reminders}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={() => loadReminders(true)} />
          }
          contentContainerStyle={reminders.length === 0 ? styles.emptyContent : styles.listContent}
          ListEmptyComponent={
            !loading ? (
              <EmptyState
                icon="alarm-outline"
                title="No reminders pending"
                message="Add a reminder to start medicine alerts."
              />
            ) : null
          }
          ListHeaderComponent={
            history.length > 0 ? (
              <AppCard variant="outlined" style={styles.historyCard}>
                <Text style={styles.historyTitle}>Notification History</Text>
                {history.slice(0, 5).map((entry) => (
                  <View key={entry.id} style={styles.historyRow}>
                    <Text style={styles.historyBody} numberOfLines={1}>
                      {entry.body}
                    </Text>
                    <Text style={styles.historyMeta}>
                      {entry.status} • {entry.sent_at ? new Date(entry.sent_at).toLocaleTimeString() : '--'}
                    </Text>
                  </View>
                ))}
              </AppCard>
            ) : null
          }
          renderItem={({ item }) => (
            <AppCard variant="elevated" style={styles.card}>
              <View style={styles.cardRow}>
                <View style={styles.iconWrap}>
                  <Ionicons name="alarm-outline" size={18} color={colors.primary} />
                </View>
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>{item.name || 'Medicine'}</Text>
                  <Text style={styles.cardSubtitle}>Reminder at {item.reminder_time || '--:--'}</Text>
                </View>
                <AppButton
                  title="Trigger"
                  size="small"
                  variant="secondary"
                  onPress={() => handleTriggerReminder(item)}
                  style={styles.triggerBtn}
                />
                <AppButton
                  title="Done"
                  size="small"
                  variant="primary"
                  loading={completingReminderId === String(item.id)}
                  disabled={completingReminderId === String(item.id)}
                  onPress={() => handleCompleteReminder(item)}
                />
              </View>
            </AppCard>
          )}
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
    borderRadius: 18,
    backgroundColor: colors.cardMuted,
    marginBottom: spacing.md,
  },
  formTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  formHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  medicineChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  noMedicine: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    borderRadius: 18,
    backgroundColor: colors.cardElevated,
    marginBottom: spacing.sm,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardMuted,
    marginRight: spacing.sm,
  },
  cardText: {
    flex: 1,
    marginRight: spacing.xs,
  },
  cardTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  cardSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  triggerBtn: {
    marginRight: spacing.xs,
  },
  historyCard: {
    marginBottom: spacing.sm,
    borderColor: colors.border,
    backgroundColor: colors.cardMuted,
  },
  historyTitle: {
    ...typography.body,
    fontWeight: '700',
    marginBottom: spacing.xs,
    color: colors.textPrimary,
  },
  historyRow: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  historyBody: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  historyMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
