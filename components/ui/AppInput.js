import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

export default function AppInput({
  label,
  placeholder,
  value,
  onChangeText,
  keyboardType = 'default',
  secureTextEntry = false,
  error,
  multiline = false,
  editable = true,
  pointerEvents = 'auto',
}) {
  const [isFocused, setIsFocused] = useState(false);

  // Reusable form component:
  // one input style used across screens keeps forms consistent and easier to maintain.
  return (
    <View style={styles.wrapper} pointerEvents={pointerEvents}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <TextInput
        style={[
          styles.input,
          isFocused && styles.focusedInput, // Focus state helps users see active field.
          error && styles.errorInput, // Validation UX: red border indicates field needs attention.
          multiline && styles.multilineInput,
          !editable && styles.readOnlyInput,
        ]}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        editable={editable}
        selectTextOnFocus={editable}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        textAlignVertical={multiline ? 'top' : 'center'}
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: spacing.md - 2,
    paddingVertical: 13,
    backgroundColor: colors.cardMuted,
    color: colors.textPrimary,
    ...typography.body,
  },
  focusedInput: {
    borderColor: colors.primaryStrong,
  },
  errorInput: {
    borderColor: colors.danger,
  },
  multilineInput: {
    minHeight: 100,
    paddingTop: spacing.sm + spacing.xs,
  },
  readOnlyInput: {
    backgroundColor: colors.card,
    opacity: 0.8,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
  },
});
