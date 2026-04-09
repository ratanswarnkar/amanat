import { useContext, useEffect } from 'react';
import { Redirect, Stack } from 'expo-router';
import AppLoader from '../../components/ui/AppLoader';
import { AuthContext } from '../../context/AuthContext';
import { setupPushNotifications } from '../../src/services/notificationService';

export default function MainLayout() {
  const { token, isAuthLoading } = useContext(AuthContext);

  useEffect(() => {
    if (!token) {
      return;
    }

    setupPushNotifications().catch((error) => {
      console.log('[Push Setup Error]', error?.message || error);
    });
  }, [token]);

  if (isAuthLoading) {
    return <AppLoader text="Loading session..." fullScreen />;
  }

  if (!token) {
    return <Redirect href="/mobile" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
