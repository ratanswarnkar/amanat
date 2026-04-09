import Constants from 'expo-constants';
import { useState } from 'react';
import { Alert, Platform } from 'react-native';

export default function useVoiceMedicine() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const isExpoGo = Constants.appOwnership === 'expo';
  const isVoiceSupported = false;

  const startListening = async () => {
    const message =
      Platform.OS === 'web'
        ? 'Voice recognition is not available on web preview.'
        : isExpoGo
          ? 'Voice input is disabled in Expo Go.'
          : 'Voice input has been disabled for build stability.';
    setVoiceError(message);
    setIsListening(false);
    Alert.alert('Voice unavailable', message);
  };

  const stopListening = async () => {
    setIsListening(false);
  };

  return {
    isListening,
    transcript,
    voiceError,
    isVoiceSupported,
    startListening,
    stopListening,
    setTranscript,
  };
}
