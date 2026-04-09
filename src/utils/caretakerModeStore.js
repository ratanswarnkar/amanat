import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTIVE_MODE_KEY = 'AMANAT_ACTIVE_MODE';
const ACTIVE_PATIENT_ID_KEY = 'AMANAT_ACTIVE_PATIENT_ID';
const ACTIVE_PATIENT_NAME_KEY = 'AMANAT_ACTIVE_PATIENT_NAME';

export const MODE_OWNER = 'owner';
export const MODE_CARETAKER = 'caretaker';

export const getStoredCareMode = async () => {
  const [mode, patientId, patientName] = await AsyncStorage.multiGet([
    ACTIVE_MODE_KEY,
    ACTIVE_PATIENT_ID_KEY,
    ACTIVE_PATIENT_NAME_KEY,
  ]).then((entries) => entries.map((entry) => entry[1]));

  return {
    mode: mode || MODE_OWNER,
    patientId: patientId || null,
    patientName: patientName || null,
  };
};

export const setStoredCareMode = async ({ mode, patientId, patientName }) => {
  const updates = [
    [ACTIVE_MODE_KEY, mode || MODE_OWNER],
    [ACTIVE_PATIENT_ID_KEY, patientId || ''],
    [ACTIVE_PATIENT_NAME_KEY, patientName || ''],
  ];

  await AsyncStorage.multiSet(updates);
};

export const clearStoredCareMode = async () => {
  await AsyncStorage.multiRemove([
    ACTIVE_MODE_KEY,
    ACTIVE_PATIENT_ID_KEY,
    ACTIVE_PATIENT_NAME_KEY,
  ]);
};

export const getActivePatientId = async (fallbackUserId = null) => {
  const state = await getStoredCareMode();
  return state.patientId || fallbackUserId || null;
};
