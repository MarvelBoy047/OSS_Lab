declare global {
  interface Window {
    electronAPI: {
      selectDatasetFile: () => Promise<{
        absolutePath: string;
        fileName: string;
        fileSize: number;
        exists: boolean;
      } | null>;
      getDroppedFilePath: (file: File) => Promise<{
        absolutePath: string;
        fileName: string;
        fileSize: number;
        exists: boolean;
      }>;
      // Add the missing methods:
      openFileDialog: () => Promise<string[]>;
      getFileStats: (filePath: string) => Promise<{ size: number }>;
      isElectron: boolean;
      platform: string;
      versions: NodeJS.ProcessVersions;
      getSystemInfo: () => {
        platform: string;
        arch: string;
        nodeVersion: string;
        electronVersion: string;
      };
    };
  }
}

export {};
