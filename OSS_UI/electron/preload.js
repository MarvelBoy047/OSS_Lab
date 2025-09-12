const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File selection APIs
  selectDatasetFile: () => ipcRenderer.invoke('select-dataset-file'),
  
  // Add the missing methods:
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  getFileStats: (filePath) => ipcRenderer.invoke('fs:getFileStats', filePath),
  
  // Use webUtils to get real file paths from dropped files
  getDroppedFilePath: async (file) => {
    try {
      const absolutePath = webUtils.getPathForFile(file);
      return ipcRenderer.invoke('process-file-path', {
        absolutePath,
        fileName: file.name,
        fileSize: file.size
      });
    } catch (error) {
      throw new Error(`Failed to get file path: ${error.message}`);
    }
  },
  
  // System info
  isElectron: true,
  platform: process.platform,
  versions: process.versions,
  
  // System info getter
  getSystemInfo: () => ({
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.versions.node,
    electronVersion: process.versions.electron
  })
});

console.log('Preload script loaded successfully');
