import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'token';
const REFRESH_TOKEN_KEY = 'refreshToken';
const OTP_VERIFIED_TOKEN_KEY = 'otpVerifiedToken';

let secureStoreAvailablePromise = null;

const isSecureStoreAvailable = async () => {
  if (!secureStoreAvailablePromise) {
    secureStoreAvailablePromise = SecureStore.isAvailableAsync().catch(() => false);
  }

  return secureStoreAvailablePromise;
};

const setSecureItem = async (key, value) => {
  const hasSecureStore = await isSecureStoreAvailable();

  if (hasSecureStore) {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    return;
  }

  await AsyncStorage.setItem(key, value);
};

const getSecureItem = async (key) => {
  const hasSecureStore = await isSecureStoreAvailable();

  if (hasSecureStore) {
    return SecureStore.getItemAsync(key);
  }

  return AsyncStorage.getItem(key);
};

const removeSecureItem = async (key) => {
  const hasSecureStore = await isSecureStoreAvailable();

  if (hasSecureStore) {
    await SecureStore.deleteItemAsync(key);
    return;
  }

  await AsyncStorage.removeItem(key);
};

export const saveToken = async (token) => {
  if (!token) {
    await removeSecureItem(TOKEN_KEY);
    return;
  }
  await setSecureItem(TOKEN_KEY, token);
};

export const getToken = async () => getSecureItem(TOKEN_KEY);

export const removeToken = async () => removeSecureItem(TOKEN_KEY);

export const saveRefreshToken = async (refreshToken) => {
  if (!refreshToken) {
    await removeSecureItem(REFRESH_TOKEN_KEY);
    return;
  }
  await setSecureItem(REFRESH_TOKEN_KEY, refreshToken);
};

export const getRefreshToken = async () => getSecureItem(REFRESH_TOKEN_KEY);

export const removeRefreshToken = async () => removeSecureItem(REFRESH_TOKEN_KEY);

export const clearAuthSecrets = async () => {
  await Promise.allSettled([removeToken(), removeRefreshToken(), removeOtpVerifiedToken()]);
};

export const saveOtpVerifiedToken = async (token) => {
  if (!token) {
    await removeSecureItem(OTP_VERIFIED_TOKEN_KEY);
    return;
  }

  await setSecureItem(OTP_VERIFIED_TOKEN_KEY, token);
};

export const getOtpVerifiedToken = async () => getSecureItem(OTP_VERIFIED_TOKEN_KEY);

export const removeOtpVerifiedToken = async () => removeSecureItem(OTP_VERIFIED_TOKEN_KEY);
