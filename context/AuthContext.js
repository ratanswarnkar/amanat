import AsyncStorage from "@react-native-async-storage/async-storage";
import { signOut } from "firebase/auth";
import { createContext, useCallback, useEffect, useState } from "react";
import { logoutSession } from "../src/api/auth";
import { setAuthFailureHandler } from "../src/api/client";
import { auth } from "../src/config/firebase";
import {
  clearAuthSecrets,
  getRefreshToken as readRefreshToken,
  getToken as readToken,
  removeRefreshToken,
  removeToken,
  saveRefreshToken,
  saveToken,
} from "../src/utils/secureStore";
import {
  getActiveRoleKeys,
  getDefaultSessionRole,
  toRoleKey,
} from "../src/utils/roleRouting";
import {
  clearStoredCareMode,
  getStoredCareMode,
  MODE_CARETAKER,
  MODE_OWNER,
  setStoredCareMode,
} from "../src/utils/caretakerModeStore";
import { getUserRoles } from "../services/userService";

export const AuthContext = createContext();
const ROLE_STORAGE_KEY = "AMANAT_USER_ROLE";
const ROLES_STORAGE_KEY = "AMANAT_USER_ROLES";
const MOBILE_KEY = "mobile";
const USER_KEY = "user";
const CARETAKER_PATIENTS_KEY = "AMANAT_CARETAKER_PATIENTS";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [mobile, setMobile] = useState("");
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [activeMode, setActiveMode] = useState(MODE_OWNER);
  const [activePatientId, setActivePatientId] = useState(null);
  const [activePatientName, setActivePatientName] = useState(null);
  const [caretakerPatients, setCaretakerPatients] = useState([]);
  const [caretakerRolesError, setCaretakerRolesError] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const deriveFallbackRoles = (nextUser) => {
    if (nextUser?.role === "nominee") {
      return {
        owner: false,
        nominee: true,
      };
    }

    return {
      owner: true,
      nominee: false,
    };
  };

  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        const savedToken = await readToken();
        const savedRefreshToken = await readRefreshToken();
        const savedMobile = await AsyncStorage.getItem(MOBILE_KEY);
        const savedUser = await AsyncStorage.getItem(USER_KEY);
        const savedRole = await AsyncStorage.getItem(ROLE_STORAGE_KEY);
        const savedRoles = await AsyncStorage.getItem(ROLES_STORAGE_KEY);
        const savedCaretakerPatients = await AsyncStorage.getItem(CARETAKER_PATIENTS_KEY);
        const parsedUser = savedUser ? JSON.parse(savedUser) : null;
        const parsedRoles = savedRoles ? JSON.parse(savedRoles) : null;
        const parsedCaretakerPatients = savedCaretakerPatients
          ? JSON.parse(savedCaretakerPatients)
          : [];
        const storedCareMode = await getStoredCareMode();
        const activeRoles = getActiveRoleKeys(parsedRoles || {});
        const nextRole = savedToken
          ? (activeRoles.includes(toRoleKey(savedRole))
            ? savedRole
            : getDefaultSessionRole(parsedRoles || deriveFallbackRoles(parsedUser)))
          : null;

        setToken(savedToken || null);
        setRefreshToken(savedRefreshToken || null);
        setMobile(savedMobile || "");
        setUser(parsedUser);
        setRoles(parsedRoles || (parsedUser ? deriveFallbackRoles(parsedUser) : null));
        setUserRole(nextRole);
        setCaretakerPatients(Array.isArray(parsedCaretakerPatients) ? parsedCaretakerPatients : []);
        setCaretakerRolesError(null);
        const resolvedPatientId = parsedUser?.id || null;
        const selectedPatient = (parsedCaretakerPatients || []).find(
          (item) => String(item?.patient_id || "") === String(storedCareMode.patientId || "")
        );
        const shouldKeepCaretakerMode = storedCareMode.mode === MODE_CARETAKER
          && Boolean(storedCareMode.patientId)
          && Boolean(selectedPatient)
          && Boolean(savedToken);
        setActiveMode(shouldKeepCaretakerMode ? MODE_CARETAKER : MODE_OWNER);
        setActivePatientId(shouldKeepCaretakerMode ? storedCareMode.patientId : resolvedPatientId);
        setActivePatientName(shouldKeepCaretakerMode
          ? (selectedPatient?.patient_name || storedCareMode.patientName || null)
          : (parsedUser?.full_name || parsedUser?.name || null));
      } catch (_error) {
        setToken(null);
        setRefreshToken(null);
        setMobile("");
        setUser(null);
        setRoles(null);
        setUserRole(null);
        setCaretakerPatients([]);
        setCaretakerRolesError(null);
        setActiveMode(MODE_OWNER);
        setActivePatientId(null);
        setActivePatientName(null);
      } finally {
        setIsAuthLoading(false);
      }
    };

    bootstrapAuth();
  }, []);

  useEffect(() => {
    setAuthFailureHandler(async () => {
      setToken(null);
      setRefreshToken(null);
      setMobile("");
      setUser(null);
      setRoles(null);
      setUserRole(null);
      setCaretakerPatients([]);
      setCaretakerRolesError(null);
      setActiveMode(MODE_OWNER);
      setActivePatientId(null);
      setActivePatientName(null);
      await AsyncStorage.multiRemove([MOBILE_KEY, USER_KEY, ROLE_STORAGE_KEY, ROLES_STORAGE_KEY]);
      await AsyncStorage.removeItem(CARETAKER_PATIENTS_KEY);
      await clearStoredCareMode();
    });

    return () => {
      setAuthFailureHandler(null);
    };
  }, []);

  const setSession = async ({
    token: nextToken,
    refreshToken: nextRefreshToken,
    mobile: nextMobile,
    user: nextUser,
    roles: nextRoles,
  }) => {
    const resolvedRoles = nextRoles || deriveFallbackRoles(nextUser);
    const currentRoleKey = toRoleKey(userRole);
    const nextRole = userRole && getActiveRoleKeys(resolvedRoles).includes(currentRoleKey)
      ? userRole
      : getDefaultSessionRole(resolvedRoles, nextUser?.role === "nominee" ? "nominee" : "user");

    if (nextToken) {
      await saveToken(nextToken);
    } else {
      await removeToken();
    }

    if (nextRefreshToken) {
      await saveRefreshToken(nextRefreshToken);
    } else {
      await removeRefreshToken();
    }

    if (typeof nextMobile === "string") {
      if (nextMobile) {
        await AsyncStorage.setItem(MOBILE_KEY, nextMobile);
      } else {
        await AsyncStorage.removeItem(MOBILE_KEY);
      }
    }

    if (nextUser) {
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    } else {
      await AsyncStorage.removeItem(USER_KEY);
    }

    await AsyncStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(resolvedRoles));
    await AsyncStorage.setItem(ROLE_STORAGE_KEY, nextRole);
    await AsyncStorage.setItem(CARETAKER_PATIENTS_KEY, JSON.stringify([]));
    const defaultPatientId = nextUser?.id || null;
    const defaultPatientName = nextUser?.full_name || nextUser?.name || null;
    await setStoredCareMode({
      mode: MODE_OWNER,
      patientId: defaultPatientId,
      patientName: defaultPatientName,
    });

    setToken(nextToken || null);
    setRefreshToken(nextRefreshToken || null);
    setMobile(nextMobile || "");
    setUser(nextUser || null);
    setRoles(resolvedRoles);
    setUserRole(nextRole);
    setCaretakerPatients([]);
    setActiveMode(MODE_OWNER);
    setActivePatientId(defaultPatientId);
    setActivePatientName(defaultPatientName);
  };

  const refreshCaretakerPatients = useCallback(async () => {
    try {
      const rolesPayload = await getUserRoles();
      const nextPatients = Array.isArray(rolesPayload?.caretakerOf) ? rolesPayload.caretakerOf : [];
      await AsyncStorage.setItem(CARETAKER_PATIENTS_KEY, JSON.stringify(nextPatients));
      setCaretakerPatients(nextPatients);
      setCaretakerRolesError(null);

      const hasActivePatient = nextPatients.some(
        (item) => String(item?.patient_id || "") === String(activePatientId || "")
      );

      if (activeMode === MODE_CARETAKER && !hasActivePatient) {
        const ownerId = user?.id || null;
        const ownerName = user?.full_name || user?.name || null;
        await setStoredCareMode({
          mode: MODE_OWNER,
          patientId: ownerId,
          patientName: ownerName,
        });
        setActiveMode(MODE_OWNER);
        setActivePatientId(ownerId);
        setActivePatientName(ownerName);
      }

      return nextPatients;
    } catch (error) {
      await AsyncStorage.setItem(CARETAKER_PATIENTS_KEY, JSON.stringify([]));
      setCaretakerPatients([]);
      setCaretakerRolesError(error?.message || 'Failed to load caretaker assignments');
      return [];
    }
  }, [activeMode, activePatientId, user?.full_name, user?.id, user?.name]);

  const updateStoredMobile = async (nextMobile) => {
    if (nextMobile) {
      await AsyncStorage.setItem(MOBILE_KEY, nextMobile);
    } else {
      await AsyncStorage.removeItem(MOBILE_KEY);
    }

    setMobile(nextMobile || "");
  };

  const updateStoredUser = async (updates) => {
    setUser((previousUser) => {
      const nextUser = previousUser ? { ...previousUser, ...updates } : { ...updates };
      AsyncStorage.setItem(USER_KEY, JSON.stringify(nextUser)).catch(() => null);
      return nextUser;
    });
  };

  const selectRole = async (nextRole) => {
    const allowedRoles = new Set(["user", "nominee"]);
    if (!allowedRoles.has(nextRole)) {
      return;
    }

    await AsyncStorage.setItem(ROLE_STORAGE_KEY, nextRole);
    setUserRole(nextRole);
  };

  const loginAsUser = async () => {
    await selectRole("user");
  };

  const loginAsNominee = async () => {
    await selectRole("nominee");
  };

  const logout = async () => {
    try {
      const storedRefreshToken = await readRefreshToken();
      if (storedRefreshToken) {
        await logoutSession(storedRefreshToken).catch(() => null);
      }
      await signOut(auth);
    } catch (_error) {
      // ignore; still clear local session
    }

    await clearAuthSecrets();
    await AsyncStorage.multiRemove([MOBILE_KEY, USER_KEY, ROLE_STORAGE_KEY, ROLES_STORAGE_KEY]);
    await AsyncStorage.removeItem(CARETAKER_PATIENTS_KEY);
    await clearStoredCareMode();

    setToken(null);
    setRefreshToken(null);
    setMobile("");
    setUser(null);
    setRoles(null);
    setUserRole(null);
    setCaretakerPatients([]);
    setCaretakerRolesError(null);
    setActiveMode(MODE_OWNER);
    setActivePatientId(null);
    setActivePatientName(null);
  };

  const switchToOwner = useCallback(async (ownerUserId = null) => {
    const ownerId = ownerUserId || user?.id || null;
    const ownerName = user?.full_name || user?.name || null;
    await setStoredCareMode({
      mode: MODE_OWNER,
      patientId: ownerId,
      patientName: ownerName,
    });
    setActiveMode(MODE_OWNER);
    setActivePatientId(ownerId);
    setActivePatientName(ownerName);
  }, [user?.full_name, user?.id, user?.name]);

  const switchToCaretaker = useCallback(async (patientId) => {
    const selectedPatient = caretakerPatients.find(
      (item) => String(item?.patient_id || "") === String(patientId || "")
    );
    if (!selectedPatient) {
      return false;
    }

    await setStoredCareMode({
      mode: MODE_CARETAKER,
      patientId: selectedPatient.patient_id,
      patientName: selectedPatient.patient_name,
    });
    setActiveMode(MODE_CARETAKER);
    setActivePatientId(selectedPatient.patient_id || null);
    setActivePatientName(selectedPatient.patient_name || null);
    return true;
  }, [caretakerPatients]);

  const switchToOwnerMode = async () => switchToOwner(user?.id || null);
  const switchToCaretakerMode = async ({ patientId }) => switchToCaretaker(patientId);

  useEffect(() => {
    if (!token || !user?.id) {
      return;
    }

    refreshCaretakerPatients();
  }, [token, user?.id]);

  return (
    <AuthContext.Provider
      value={{
        token,
        refreshToken,
        mobile,
        user,
        roles,
        userRole,
        activeMode,
        activePatientId,
        activePatientName,
        caretakerPatients,
        caretakerRolesError,
        isAuthLoading,
        setSession,
        updateStoredMobile,
        updateStoredUser,
        selectRole,
        loginAsUser,
        loginAsNominee,
        refreshCaretakerPatients,
        switchToOwner,
        switchToCaretaker,
        switchToOwnerMode,
        switchToCaretakerMode,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
