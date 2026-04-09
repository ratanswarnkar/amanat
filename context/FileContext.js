import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AuthContext } from './AuthContext';
import { getVaultFiles } from '../src/api/vault';

export const FileContext = createContext();

export function FileProvider({ children }) {
  const { token, userRole } = useContext(AuthContext);
  const [files, setFiles] = useState([]);

  const refreshFiles = useCallback(async () => {
    if (!token || userRole !== 'user') {
      setFiles([]);
      return [];
    }

    try {
      const nextFiles = await getVaultFiles();
      setFiles(Array.isArray(nextFiles) ? nextFiles : []);
      return nextFiles;
    } catch (error) {
      console.log('Error loading files from API:', error);
      setFiles([]);
      return [];
    }
  }, [token, userRole]);

  useEffect(() => {
    refreshFiles();
  }, [refreshFiles]);

  return (
    <FileContext.Provider
      value={{
        files,
        refreshFiles,
        addFile: refreshFiles,
        removeFile: refreshFiles,
      }}
    >
      {children}
    </FileContext.Provider>
  );
}
