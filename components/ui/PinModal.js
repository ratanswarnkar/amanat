import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import AppButton from '../AppButton';
import AppInput from './AppInput';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

export default function PinModal({
  visible,
  title = 'Verify PIN',
  description = 'Enter your 4-digit PIN to continue.',
  submitLabel = 'Verify PIN',
  error = '',
  loading = false,
  onSubmit,
  onClose,
}) {
  const [pin, setPin] = useState('');

  useEffect(() => {
    if (!visible) {
      setPin('');
    }
  }, [visible]);

  const handleSubmit = () => {
    onSubmit?.(pin, () => setPin(''));
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>

          <AppInput
            label="PIN"
            placeholder="Enter 4-digit PIN"
            value={pin}
            onChangeText={setPin}
            keyboardType="number-pad"
            secureTextEntry
            error={error}
          />

          <View style={styles.actions}>
            <AppButton
              title="Cancel"
              onPress={onClose}
              variant="ghost"
              style={styles.actionButton}
              disabled={loading}
            />
            <AppButton
              title={submitLabel}
              onPress={handleSubmit}
              loading={loading}
              style={styles.actionButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 20, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    ...typography.headingMedium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  actionButton: {
    minWidth: 110,
  },
});
