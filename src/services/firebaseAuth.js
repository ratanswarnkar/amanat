import { Platform } from 'react-native';
import {
  PhoneAuthProvider,
  RecaptchaVerifier,
  signInWithCredential,
  signInWithPhoneNumber,
} from 'firebase/auth';
import { auth } from '../config/firebase';

let confirmationResult = null; // web
let recaptchaVerifier = null; // web
let verificationId = ''; // native
let pendingMobile = '';

const normalizeMobile = (phoneNumber) => phoneNumber.replace(/\D/g, '').slice(-10);

const toE164 = (phoneNumber) => {
  const digits = phoneNumber.replace(/\D/g, '');

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }

  if (phoneNumber.startsWith('+')) {
    return phoneNumber;
  }

  throw new Error('Enter a valid phone number with country code support.');
};

const getRecaptchaVerifier = () => {
  if (Platform.OS !== 'web') {
    return null;
  }

  if (typeof window === 'undefined') {
    throw new Error('Firebase OTP is unavailable in this environment.');
  }

  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(auth, 'firebase-recaptcha-container', {
      size: 'invisible',
    });
  }

  return recaptchaVerifier;
};

const toUserMessage = (error) => {
  const code = error?.code || '';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Please wait and try again later.';
  if (code === 'auth/invalid-verification-code') return 'Invalid OTP. Please check the code and try again.';
  if (code === 'auth/code-expired') return 'OTP expired. Please request a new code.';
  if (code === 'auth/network-request-failed') return 'Network error. Please check your internet and retry.';
  if (code === 'auth/missing-app-credential') return 'App verification failed. Please try again.';
  if (code === 'auth/app-not-authorized') return 'App is not authorized for phone auth. Contact support.';
  return error?.message || 'Something went wrong. Please try again.';
};

const wrapFirebaseError = (error) => {
  const wrapped = new Error(toUserMessage(error));
  wrapped.code = error?.code;
  wrapped.originalMessage = error?.message;
  return wrapped;
};

export const sendOTP = async (phoneNumber, applicationVerifier) => {
  pendingMobile = normalizeMobile(phoneNumber);
  verificationId = '';

  try {
    if (Platform.OS === 'web') {
      const verifier = getRecaptchaVerifier();
      confirmationResult = await signInWithPhoneNumber(auth, toE164(phoneNumber), verifier);

      return {
        success: true,
        message: 'OTP sent successfully',
        provider: 'firebase',
      };
    }

    if (!applicationVerifier) {
      const err = new Error('OTP verifier is not ready. Please try again.');
      err.code = 'auth/missing-app-credential';
      throw err;
    }

    const provider = new PhoneAuthProvider(auth);
    verificationId = await provider.verifyPhoneNumber(toE164(phoneNumber), applicationVerifier);

    return {
      success: true,
      message: 'OTP sent successfully',
      provider: 'firebase',
    };
  } catch (error) {
    throw wrapFirebaseError(error);
  }
};

export const verifyOTP = async (code) => {
  if (!pendingMobile) {
    throw new Error('Please request an OTP first.');
  }

  try {
    if (Platform.OS === 'web') {
      if (!confirmationResult) {
        const err = new Error('OTP session expired. Please request a new code.');
        err.code = 'auth/code-expired';
        throw err;
      }

      const credentialResult = await confirmationResult.confirm(code);
      const idToken = await credentialResult.user.getIdToken();

      return {
        mobile: pendingMobile,
        idToken,
        firebaseUser: {
          uid: credentialResult.user.uid,
          phoneNumber: credentialResult.user.phoneNumber,
        },
      };
    }

    if (!verificationId) {
      const err = new Error('OTP session expired. Please request a new code.');
      err.code = 'auth/code-expired';
      throw err;
    }

    const credential = PhoneAuthProvider.credential(verificationId, code);
    const credentialResult = await signInWithCredential(auth, credential);
    const idToken = await credentialResult.user.getIdToken();

    return {
      mobile: pendingMobile,
      idToken,
      firebaseUser: {
        uid: credentialResult.user.uid,
        phoneNumber: credentialResult.user.phoneNumber,
      },
    };
  } catch (error) {
    throw wrapFirebaseError(error);
  }
};

export const resetFirebaseOtpSession = () => {
  confirmationResult = null;
  verificationId = '';
};
