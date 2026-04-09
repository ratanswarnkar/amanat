import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

export default function AppInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  maxLength,
  secureTextEntry = false,
  autoCapitalize = 'none',
}) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        maxLength={maxLength}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        style={styles.input}
        placeholderTextColor="#94A3B8"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  input: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0F172A',
  },
});
