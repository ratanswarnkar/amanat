import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { registerNotificationDevice } from '../api/healthcare';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const resolveProjectId = () => {
  return (
    Constants?.expoConfig?.extra?.eas?.projectId ||
    Constants?.easConfig?.projectId ||
    undefined
  );
};

const isExpoGo = () => {
  return (
    Constants?.executionEnvironment === 'storeClient' ||
    Constants?.appOwnership === 'expo'
  );
};

export const setupPushNotifications = async () => {
  if (isExpoGo()) {
    console.log(
      '[Push Setup] Remote push notifications are not supported in Expo Go. Use an EAS development build for push token testing.'
    );
    return { registered: false, reason: 'expo_go_unsupported' };
  }

  const currentSettings = await Notifications.getPermissionsAsync();
  let finalStatus = currentSettings.status;

  if (finalStatus !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }

  if (finalStatus !== 'granted') {
    return { registered: false, reason: 'permission_denied' };
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const projectId = resolveProjectId();
  const expoTokenResponse = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : {}
  );

  const pushToken = String(expoTokenResponse?.data || '').trim();
  if (!pushToken) {
    return { registered: false, reason: 'token_missing' };
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';

  await registerNotificationDevice({
    token: pushToken,
    platform: Platform.OS,
    timezone,
    app_id: Constants?.expoConfig?.slug || 'amanat-app',
    is_active: true,
  });

  return { registered: true, token: pushToken };
};
