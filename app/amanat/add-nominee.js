import { router, useRootNavigationState } from 'expo-router';
import { useContext, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import AppButton from '../../components/AppButton';
import AppHeader from '../../components/ui/AppHeader';
import AppInput from '../../components/ui/AppInput';
import { AuthContext } from '../../context/AuthContext';
import { NomineeContext } from '../../context/NomineeContext';
import { createNominee } from '../../src/api/nominee';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

export default function AddNomineeScreen() {
  const { refreshNominees } = useContext(NomineeContext);
  const { userRole } = useContext(AuthContext);
  const navState = useRootNavigationState();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [relationshipError, setRelationshipError] = useState('');

  useEffect(() => {
    // Wait for root router readiness before auto-redirecting from effects.
    if (!navState?.key) return;

    if (userRole === 'nominee') {
      router.replace('/nominee-dashboard');
      return;
    }

    if (userRole === null) {
      router.replace('/login');
    }
  }, [userRole, navState]);

  const handleSaveNominee = async () => {
    let hasError = false;

    if (!name.trim()) {
      setNameError('Name is required.');
      hasError = true;
    } else {
      setNameError('');
    }

    if (!phone.trim()) {
      setPhoneError('Phone number is required.');
      hasError = true;
    } else {
      setPhoneError('');
    }

    if (!relationship.trim()) {
      setRelationshipError('Relationship is required.');
      hasError = true;
    } else {
      setRelationshipError('');
    }

    if (hasError) {
      Alert.alert('Validation Error', 'Please fix the highlighted fields.');
      return;
    }

    try {
      await createNominee({
        name: name.trim(),
        phone: phone.trim(),
        relationship: relationship.trim(),
      });
      await refreshNominees();
      Alert.alert('Success', 'Nominee added successfully.');
      router.replace('/nominees');
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.message || error?.message || 'Failed to add nominee.');
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Add Nominee" showBack />
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading}>Nominee Details</Text>

        <View style={styles.section}>
          <AppInput
            label="Name"
            placeholder="Enter nominee name"
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (nameError) setNameError('');
            }}
            error={nameError}
          />

          <AppInput
            label="Phone Number"
            placeholder="Enter phone number"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={(text) => {
              setPhone(text);
              if (phoneError) setPhoneError('');
            }}
            error={phoneError}
          />

          <AppInput
            label="Relationship"
            placeholder="Enter relationship"
            value={relationship}
            onChangeText={(text) => {
              setRelationship(text);
              if (relationshipError) setRelationshipError('');
            }}
            error={relationshipError}
          />
        </View>

        <AppButton title="Save Nominee" onPress={handleSaveNominee} variant="primary" />
      </ScrollView>
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
  },
  contentContainer: {
    padding: spacing.lg,
    paddingTop: spacing.md,
  },
  heading: {
    ...typography.headingMedium,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  section: {
    marginBottom: spacing.sm,
  },
});
