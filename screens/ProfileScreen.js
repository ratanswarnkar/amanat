import { router } from 'expo-router';
import { useContext, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import AppButton from '../components/AppButton';
import ModeSwitcher from '../components/ModeSwitcher';
import AppCard from '../components/ui/AppCard';
import AppHeader from '../components/ui/AppHeader';
import AppInput from '../components/ui/AppInput';
import AppLoader from '../components/ui/AppLoader';
import { AuthContext } from '../context/AuthContext';
import { FileContext } from '../context/FileContext';
import { NomineeContext } from '../context/NomineeContext';
import { fetchProfile, updateProfile } from '../src/api/profile';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

export default function ProfileScreen() {
  const {
    logout,
    user,
    updateStoredUser,
    activeMode,
    activePatientId,
    caretakerPatients,
    caretakerRolesError,
    refreshCaretakerPatients,
    switchToOwner,
    switchToCaretaker,
  } = useContext(AuthContext);
  const { files } = useContext(FileContext);
  const { nominees } = useContext(NomineeContext);
  const [fullName, setFullName] = useState(String(user?.full_name || user?.name || '').trim());
  const [email, setEmail] = useState(String(user?.email || '').trim());
  const [phone, setPhone] = useState(String(user?.phone || user?.mobile || '').trim());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const isMountedRef = useRef(true);
  const hasLoadedRef = useRef(false);
  const isFetchingProfileRef = useRef(false);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (caretakerRolesError) {
      Toast.show({
        type: 'error',
        text1: 'Access denied',
        text2: caretakerRolesError,
      });
    }
  }, [caretakerRolesError]);

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const applyProfile = async (profile) => {
    const nextName = String(profile?.name || '').trim();
    const nextEmail = String(profile?.email || '').trim();
    const nextPhone = String(profile?.phone || '').trim();

    if (!isMountedRef.current) {
      return;
    }

    setFullName(nextName);
    setEmail(nextEmail);
    setPhone(nextPhone);
    await updateStoredUser({
      name: nextName,
      full_name: nextName,
      email: nextEmail,
      phone: nextPhone,
      mobile: nextPhone,
    });
  };

  const loadProfile = async () => {
    if (isFetchingProfileRef.current) {
      return;
    }

    isFetchingProfileRef.current = true;

    try {
      if (isMountedRef.current) {
        setLoadError('');
        setIsLoading(true);
      }

      const profile = await fetchProfile();
      await applyProfile(profile);
    } catch (error) {
      if (isMountedRef.current) {
        setLoadError(error?.response?.data?.message || error?.message || 'Could not load profile right now.');
      }
    } finally {
      isFetchingProfileRef.current = false;
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const loadProfileAndRoles = async () => {
    await Promise.allSettled([
      loadProfile(),
      refreshCaretakerPatients(),
    ]);
  };

  useEffect(() => {
    if (hasLoadedRef.current) {
      return;
    }

    hasLoadedRef.current = true;
    loadProfileAndRoles();
  }, []);

  const handleSaveProfile = async () => {
    try {
      setIsSaving(true);
      const profile = await updateProfile({
        name: fullName.trim(),
        email: email.trim(),
      });
      await applyProfile(profile);
      Alert.alert('Success', 'Profile saved successfully.');
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.message || error?.message || 'Could not save profile right now.');
    } finally {
      setIsSaving(false);
    }
  };

  const avatarLetter = (fullName.trim()[0] || '?').toUpperCase();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <AppHeader title="Profile" showBack />
        <AppLoader text="Loading your profile..." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader title="Profile" showBack />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <AppCard variant="elevated" style={styles.headerCard}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>{avatarLetter}</Text>
          </View>
          <Text style={styles.title}>{fullName || 'Profile'}</Text>
          <Text style={styles.subtitle}>Account Profile</Text>
        </AppCard>

        {loadError ? (
          <AppCard variant="outlined">
            <Text style={styles.errorText}>{loadError}</Text>
            <AppButton title="Retry" variant="secondary" size="small" onPress={loadProfileAndRoles} />
          </AppCard>
        ) : null}

        <AppCard variant="outlined">
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <AppInput
            label="Full Name"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Enter full name"
            editable
          />
          <AppInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="Enter email address"
            keyboardType="email-address"
            editable
          />
          <AppInput
            label="Phone Number"
            value={phone}
            onChangeText={() => {}}
            placeholder="Phone number"
            keyboardType="phone-pad"
            editable={false}
          />
          <Text style={styles.helperText}>Phone number is managed by the secure login flow.</Text>
        </AppCard>

        <AppCard variant="outlined">
          <Text style={styles.sectionTitle}>Account Overview</Text>
          <View style={styles.statsRow}>
            <AppCard variant="outlined" style={styles.statItem}>
              <Text style={styles.statValue}>{files.length}</Text>
              <Text style={styles.statLabel}>Files Stored</Text>
            </AppCard>
            <AppCard variant="outlined" style={styles.statItem}>
              <Text style={styles.statValue}>{nominees.length}</Text>
              <Text style={styles.statLabel}>Nominees Added</Text>
            </AppCard>
          </View>
        </AppCard>

        <ModeSwitcher
          activeMode={activeMode}
          activePatientId={activePatientId}
          currentUserId={user?.id || null}
          caretakerPatients={caretakerPatients}
          switchToOwner={switchToOwner}
          switchToCaretaker={switchToCaretaker}
          onModeChanged={() => router.replace('/dashboard')}
        />

        <AppButton
          title="Save Profile"
          onPress={handleSaveProfile}
          variant="primary"
          loading={isSaving}
          disabled={isSaving}
        />
        <AppButton title="Logout" onPress={handleLogout} variant="secondary" style={styles.logoutButton} />
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
  headerCard: {
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.cardMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarText: {
    ...typography.headingLarge,
    color: colors.textPrimary,
  },
  title: {
    ...typography.headingMedium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  sectionTitle: {
    ...typography.headingMedium,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  helperText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: -spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    marginBottom: 0,
  },
  statValue: {
    ...typography.headingMedium,
    color: colors.textPrimary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  logoutButton: {
    marginTop: spacing.sm,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
});
