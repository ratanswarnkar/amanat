import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AuthContext } from './AuthContext';
import { deleteNominee, getNominees } from '../src/api/nominee';

export const NomineeContext = createContext();

export function NomineeProvider({ children }) {
  const { token, userRole } = useContext(AuthContext);
  const [nominees, setNominees] = useState([]);

  const refreshNominees = useCallback(async () => {
    if (!token || userRole !== 'user') {
      setNominees([]);
      return [];
    }

    try {
      const nextNominees = await getNominees();
      setNominees(Array.isArray(nextNominees) ? nextNominees : []);
      return nextNominees;
    } catch (error) {
      console.log('Error loading nominees from API:', error);
      setNominees([]);
      return [];
    }
  }, [token, userRole]);

  useEffect(() => {
    refreshNominees();
  }, [refreshNominees]);

  const removeNominee = async (id) => {
    if (!id) return;

    try {
      await deleteNominee(id);
    } catch (error) {
      console.log('Error deleting nominee from API:', error);
    } finally {
      await refreshNominees();
    }
  };

  return (
    <NomineeContext.Provider
      value={{
        nominees,
        refreshNominees,
        addNominee: refreshNominees,
        removeNominee,
        toggleAccess: async () => false,
      }}
    >
      {children}
    </NomineeContext.Provider>
  );
}
