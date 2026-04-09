import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: 'AIzaSyBGV6Vz5h4n4A5EPH6tEGb2xZV4U90aLk',
  authDomain: 'amanatapp-1c9c4.firebaseapp.com',
  projectId: 'amanatapp-1c9c4',
  storageBucket: 'amanatapp-1c9c4.firebasestorage.app',
  messagingSenderId: '567844993586',
  appId: '1:567844993586:web:9c06e40847b6d003325a2b',
};

const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

let auth;

if (Platform.OS === 'web') {
  auth = getAuth(firebaseApp);
} else {
  try {
    auth = initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (_error) {
    auth = getAuth(firebaseApp);
  }
}

auth.languageCode = 'en';

export { firebaseConfig, firebaseApp, auth };
