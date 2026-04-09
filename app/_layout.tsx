import { Stack } from 'expo-router';
import Toast from 'react-native-toast-message';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ScreenWrapper from '../components/ui/ScreenWrapper';
import { toastConfig } from '../components/ui/toastConfig';
import '../src/config/firebase';
import { AuthProvider } from '../context/AuthContext';
import { EmergencyProvider } from '../context/EmergencyContext';
import { FileProvider } from '../context/FileContext';
import { NomineeProvider } from '../context/NomineeContext';
import { colors } from '../theme/colors';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <EmergencyProvider>
          <NomineeProvider>
            <FileProvider>
              <ScreenWrapper backgroundColor={colors.background} statusBarStyle="light">
                <Stack screenOptions={{ headerShown: false }} />
                <Toast config={toastConfig} />
              </ScreenWrapper>
            </FileProvider>
          </NomineeProvider>
        </EmergencyProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
