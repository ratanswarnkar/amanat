import { Platform } from 'react-native';

export const ENV = process.env.EXPO_PUBLIC_ENV || (process.env.NODE_ENV === 'production' ? 'production' : 'development');

const normalizeUrl = (url) => String(url || '').trim().replace(/\/+$/, '');
const isLocalhostUrl = (url) => /localhost|127\.0\.0\.1/i.test(url);

const computeApiUrl = () => {
  const fromPlatformEnv = normalizeUrl(
    Platform.OS === 'android'
      ? process.env.EXPO_PUBLIC_API_URL_ANDROID
      : Platform.OS === 'ios'
        ? process.env.EXPO_PUBLIC_API_URL_IOS
        : process.env.EXPO_PUBLIC_API_URL_WEB
  );

  if (fromPlatformEnv) {
    return fromPlatformEnv;
  }

  const fromEnv = normalizeUrl(process.env.EXPO_PUBLIC_API_URL);
  if (!fromEnv) {
    const fallback = Platform.OS === 'web' ? 'http://localhost:5050' : 'http://10.0.2.2:5050';
    console.warn('[ENV] EXPO_PUBLIC_API_URL is missing. Falling back to', fallback);
    return fallback;
  }

  if (Platform.OS !== 'web' && isLocalhostUrl(fromEnv)) {
    console.warn('[ENV] EXPO_PUBLIC_API_URL points to localhost. Use a reachable LAN/host address for mobile devices.');
  }

  return fromEnv;
};

export const API_URL = computeApiUrl();

console.log('[ENV] EXPO_PUBLIC_API_URL =', process.env.EXPO_PUBLIC_API_URL);
console.log('[ENV] resolved API_URL =', API_URL);
