import { Redirect, Stack } from 'expo-router';
import { useContext } from 'react';
import AppLoader from '../../components/ui/AppLoader';
import { AuthContext } from '../../context/AuthContext';

export default function TabsLayout() {
  const { token, isAuthLoading } = useContext(AuthContext);

  if (isAuthLoading) {
    return <AppLoader text="Loading session..." fullScreen />;
  }

  if (!token) {
    return <Redirect href="/mobile" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
