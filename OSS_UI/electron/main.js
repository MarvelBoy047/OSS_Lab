const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;

function createWindow() {
  console.log('Creating main window...');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    show: false,
    icon: path.join(__dirname, 'assets/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'default',
    frame: true
  });

  const startUrl = isDev 
    ? 'http://localhost:3000' 
    : `file://${path.join(__dirname, '../out/index.html')}`;
    
  console.log(`Loading URL: ${startUrl}`);
  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    console.log('Window ready to show');
    mainWindow.show();
    
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  mainWindow.on('closed', () => {
    console.log('❌ Main window closed.');
    mainWindow = null;
  });

  mainWindow.webContents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    require('electron').shell.openExternal(navigationUrl);
  });

  console.log('Main window created successfully');
}

// Handle uncaught exceptions (prevent hanging)
process.on('uncaughtException', (error) => {
  console.error('⚠️ Uncaught Exception:', error);
  app.quit();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
  app.quit();
});

app.whenReady().then(() => {
  console.log('Electron app is ready');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 👇 CRITICAL FIX: Force quit AND exit Node.js process
app.on('window-all-closed', () => {
  console.log('🛑 All windows closed. Forcing app quit...');
  app.quit();

  // Safety net: force kill after 2 seconds if still alive
  setTimeout(() => {
    console.log('⏳ Forcing hard exit after 2 seconds...');
    process.exit(0);
  }, 2000);
});

app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    require('electron').shell.openExternal(navigationUrl);
  });
});

// File selection via dialog
ipcMain.handle('select-dataset-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    title: 'Select Dataset File',
    filters: [
      { name: 'Data Files', extensions: ['csv', 'xlsx', 'json', 'txt', 'tsv'] }
    ]
  });

  if (canceled || !filePaths.length) {
    return null;
  }

  const absolutePath = filePaths[0];
  
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const stats = fs.statSync(absolutePath);
  const fileName = path.basename(absolutePath);

  return {
    absolutePath,
    fileName,
    fileSize: stats.size,
    exists: true
  };
});

// ADD MISSING IPC HANDLERS:

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Data Files', extensions: ['csv', 'xlsx', 'json', 'txt', 'tsv'] }
    ]
  });
  return result.filePaths;
});

ipcMain.handle('fs:getFileStats', async (event, filePath) => {
  try {
    const stats = fs.statSync(filePath);
    return {
      size: stats.size,
      isFile: stats.isFile(),
      modified: stats.mtime
    };
  } catch (error) {
    throw new Error(`Failed to get file stats: ${error.message}`);
  }
});

ipcMain.handle('process-file-path', async (event, fileData) => {
  const { absolutePath, fileName, fileSize } = fileData;
  
  console.log(`📁 Processing dropped file: ${absolutePath}`);
  
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Dropped file not found: ${absolutePath}`);
  }

  const stats = fs.statSync(absolutePath);

  return {
    absolutePath,
    fileName,
    fileSize: stats.size,
    exists: true
  };
});

console.log('Main process started successfully');
