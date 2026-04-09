import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AuthContext } from './AuthContext';
import { getEmergencyStatus } from '../src/api/emergency';

export const EmergencyContext = createContext();

export function EmergencyProvider({ children }) {
  const { token, userRole } = useContext(AuthContext);
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);

  const refreshEmergencyState = useCallback(async () => {
    if (!token || userRole !== 'user') {
      setIsEmergencyActive(false);
      return false;
    }

    try {
      const status = await getEmergencyStatus();
      const nextValue = Boolean(status?.emergency_active);
      setIsEmergencyActive(nextValue);
      return nextValue;
    } catch (error) {
      console.log('Error checking emergency status from API:', error);
      setIsEmergencyActive(false);
      return false;
    }
  }, [token, userRole]);

  useEffect(() => {
    refreshEmergencyState();
  }, [refreshEmergencyState]);

  return (
    <EmergencyContext.Provider
      value={{
        isEmergencyActive,
        activateEmergency: refreshEmergencyState,
        resetEmergency: refreshEmergencyState,
        refreshEmergencyState,
      }}
    >
      {children}
    </EmergencyContext.Provider>
  );
}
