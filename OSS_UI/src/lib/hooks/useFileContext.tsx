import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface FileInfo {
  id: string;
  name: string;
  path: string;
  size: number;
}

export interface FileContextType {
  files: FileInfo[];
  addFiles: (files: FileList) => void;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  getFilePaths: () => string[];
}

const FileContext = createContext<FileContextType | undefined>(undefined);

interface FileProviderProps {
  children: ReactNode;
}

export const FileProvider = ({ children }: FileProviderProps): JSX.Element => {
  const [files, setFiles] = useState<FileInfo[]>([]);

  const addFiles = useCallback((filesList: FileList) => {
    const newFiles: FileInfo[] = Array.from(filesList).map((file) => {
      let actualPath: string;
      
      if ((file as any).path) {
        actualPath = (file as any).path;
        console.log('✅ Electron path detected:', actualPath);
      } else {
        actualPath = `[File: ${file.name}]`;
        console.log('⚠️ Browser mode - no real path available');
      }

      return {
        id: crypto.randomUUID(),
        name: file.name,
        path: actualPath,
        size: file.size,
      };
    });

    setFiles((prev) => {
      const merged = [...prev, ...newFiles];
      localStorage.setItem('osslab_dataset_files', JSON.stringify(merged));
      return merged;
    });

    console.log(`📁 Added ${newFiles.length} files with paths:`, newFiles.map(f => f.path));
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const filtered = prev.filter((f) => f.id !== id);
      localStorage.setItem('osslab_dataset_files', JSON.stringify(filtered));
      return filtered;
    });
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
    localStorage.removeItem('osslab_dataset_files');
    console.log('🗑️ Cleared all dataset files');
  }, []);

  const getFilePaths = useCallback(() => {
    return files.map(f => f.path);
  }, [files]);

  return (
    <FileContext.Provider value={{ files, addFiles, removeFile, clearFiles, getFilePaths }}>
      {children}
    </FileContext.Provider>
  );
};

export const useFileContext = (): FileContextType => {
  const context = useContext(FileContext);
  if (!context) {
    throw new Error('useFileContext must be used within a FileProvider');
  }
  return context;
};
