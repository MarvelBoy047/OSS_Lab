'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSelectedLayoutSegments } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useFileContext } from '@/lib/hooks/useFileContext';
import { 
  Trash2, 
  CheckCircle, 
  Wifi, 
  WifiOff,
  Activity,
  Cpu,
  MemoryStick,
  Globe,
  FileSpreadsheet,
  type LucideIcon
} from 'lucide-react';

// Types
interface SystemStats {
  cpu: number;
  memory: number;
  gpu: number;
  networkUsage: number;
  isOnline: boolean;
}

interface OSSLABSidebarProps {
  uploadEnabled: boolean;
}

interface SessionFileData {
  id: string;
  name: string;
  absolutePath: string;
  size: number;
  type: string;
  selectedAt: number;
}

// Constants
const ALLOWED_FILE_TYPES = ['csv', 'json', 'xlsx', 'pdf', 'txt', 'md'];
const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

// Custom hooks
const useSystemStats = () => {
  const [stats, setStats] = useState<SystemStats>({
    cpu: 0,
    memory: 0,
    gpu: 0,
    networkUsage: 0,
    isOnline: false
  });

  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const updateStats = () => {
      setStats(prev => ({
        ...prev,
        cpu: Math.floor(Math.random() * 20) + 5,
        memory: Math.floor(Math.random() * 30) + 40,
        gpu: Math.floor(Math.random() * 15) + 10,
        networkUsage: Math.floor(Math.random() * 500) + 100,
      }));
    };

    const checkBackendStatus = async () => {
      try {
        // REMOVED: AbortController and timeout logic to allow the backend
        // to take as long as it needs to respond without terminating the connection.
        const response = await fetch(`${API_BASE}/`, { 
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          }
        });
        
        if (response.ok) {
          console.log('✅ Backend connected successfully');
          setStats(prev => ({ ...prev, isOnline: true }));
        } else {
          console.log('❌ Backend returned non-200 status:', response.status);
          setStats(prev => ({ ...prev, isOnline: false }));
        }
        
      } catch (error) {
        // This will now only catch genuine network errors, not the AbortError.
        console.error('❌ Backend connectivity check failed:', error);
        setStats(prev => ({ ...prev, isOnline: false }));
      }
    };

    updateStats();
    checkBackendStatus();
    
    const interval = setInterval(() => {
      updateStats();
      checkBackendStatus();
    }, 10000);

    return () => clearInterval(interval);
  }, [isClient]);

  return stats;
};

// Components
const StatCard = ({ label, value, icon: Icon, color = 'text-[var(--text-secondary)]' }: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
}) => (
  <div className="bg-[var(--bg-secondary)] rounded-lg p-2">
    <div className="flex items-center gap-2 mb-1">
      <Icon size={12} className={color} />
      <p className="text-xs text-[var(--sidebar-text-secondary)] font-medium">{label}</p>
    </div>
    <p className="text-sm font-bold text-[var(--sidebar-text)]">{value}</p>
  </div>
);

// Enhanced FileItem component that displays full path
const FileItem = ({ file, onRemove }: { 
  file: { id: string; name: string; path: string; size: number; [key: string]: any };
  onRemove: (id: string) => void;
}) => {
  // Extract the absolute path directly from the file object (no localStorage dependency)
  const getDisplayPath = (): string => {
    // Get path from file object properties (in-memory only)
    return (file as any).absolutePath || (file as any).fullPath || (file as any).filePath || file.path || file.name;
  };

  const displayPath = getDisplayPath();
  const isFullPath = displayPath.includes('\\') || displayPath.includes('/');

  return (
    <div className="flex items-start gap-3 p-3 bg-[var(--bg-secondary)] rounded-lg group border border-[var(--border-primary)]">
      <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 bg-green-600">
        <FileSpreadsheet size={16} className="text-white" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate text-[var(--sidebar-text)]" title={file.name}>
          {file.name}
        </div>
        <div 
          className={cn(
            "text-xs mt-1 break-all",
            isFullPath 
              ? "text-[var(--sidebar-text-secondary)]" 
              : "text-orange-500 italic"
          )}
          title={displayPath}
        >
          {isFullPath ? displayPath : `⚠️ Path missing: ${displayPath}`}
        </div>
        <div className="text-xs text-[var(--sidebar-text-secondary)] mt-1">
          {(file.size / 1024 / 1024).toFixed(1)} MB
        </div>
      </div>
      
      <button
        onClick={() => onRemove(file.id)}
        className="opacity-0 group-hover:opacity-100 text-[var(--sidebar-text-secondary)] hover:text-red-500 p-1 transition-opacity flex-shrink-0"
        title="Remove file"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
};

// Main component
const OSSLABSidebar: React.FC<OSSLABSidebarProps> = ({ uploadEnabled }) => {
  const segments = useSelectedLayoutSegments();
  const firstSegment = segments[0] ?? null;
  
  // State
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // File context from our system (in-memory only)
  const { files, addFiles, removeFile, clearFiles } = useFileContext();
  
  // Custom hooks
  const systemStats = useSystemStats();

  // Navigation links
  const navLinks = [
    { 
      icon: 'dashboard', 
      href: '/', 
      label: 'Dashboard', 
      active: firstSegment === null || firstSegment === 'dashboard' 
    },
    { 
      icon: 'explore', 
      href: '/discover', 
      label: 'Discover', 
      active: segments.includes('discover') 
    },
    { 
      icon: 'library_books', 
      href: '/library', 
      label: 'Library', 
      active: segments.includes('library') 
    }
  ];

  // Listen for message sent events to clear files (one-time use)
  useEffect(() => {
    const handleMessageSent = () => {
      if (files.length > 0) {
        console.log('🔄 Message sent - clearing files for one-time use');
        clearFiles();
        toast.info('Files used for analysis. Select again if needed.', {
          duration: 3000
        });
      }
    };

    // Listen for custom event from chat component
    window.addEventListener('chatMessageSent', handleMessageSent);
    
    // Also listen via BroadcastChannel for cross-component communication
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel('osslab-chat');
      bc.onmessage = (event) => {
        if (event.data?.type === 'message_sent') {
          handleMessageSent();
        }
      };
      
      return () => {
        window.removeEventListener('chatMessageSent', handleMessageSent);
        bc.close();
      };
    }
    
    return () => {
      window.removeEventListener('chatMessageSent', handleMessageSent);
    };
  }, [files.length, clearFiles]);

  // File selection handler with session-only storage
  const handleFilesSelected = useCallback(async () => {
    if (!window.electronAPI) {
      toast.error('File selection requires Electron desktop app');
      return;
    }

    if (isUploading) {
      console.log('⏸️ Upload already in progress');
      return;
    }

    try {
      setIsUploading(true);
      console.log('📁 Starting file selection...');
      
      const result = await window.electronAPI.selectDatasetFile();

      if (!result) {
        console.log('📁 File selection cancelled');
        return;
      }

      // Validate file type
      const fileExtension = result.fileName.split('.').pop()?.toLowerCase();
      if (!fileExtension || !ALLOWED_FILE_TYPES.includes(fileExtension)) {
        toast.error(`Unsupported file type: .${fileExtension}`, {
          duration: 3000,
          style: { zIndex: 9999 }
        });
        return;
      }

      console.log('📁 File selected successfully:', result.fileName);
      console.log('📁 Full absolute path:', result.absolutePath);

      // Validate absolute path
      if (!result.absolutePath || (!result.absolutePath.includes('\\') && !result.absolutePath.includes('/'))) {
        toast.error('Invalid file path received from system');
        return;
      }

      // Create session file data for temporary storage
      const sessionFileData: SessionFileData = {
        id: crypto.randomUUID(),
        name: result.fileName,
        absolutePath: result.absolutePath,
        size: result.fileSize,
        type: fileExtension,
        selectedAt: Date.now()
      };

      // Store in session storage for chat access (will be cleared on message sent)
      try {
        const currentSessionFiles = JSON.parse(sessionStorage.getItem('osslab_session_files') || '[]') as SessionFileData[];
        const updatedSessionFiles = [...currentSessionFiles.filter(f => f.name !== result.fileName), sessionFileData];
        sessionStorage.setItem('osslab_session_files', JSON.stringify(updatedSessionFiles));
        
        console.log('✅ Saved file to session storage:', sessionFileData.absolutePath);
      } catch (error) {
        console.error('❌ Failed to save to session storage:', error);
        toast.error('Failed to save file information');
        return;
      }

      // Create enhanced mock File object for UI with all path properties
      const mockFile = new File([''], result.fileName, { 
        type: `application/${fileExtension}` 
      });
      
      // Add size property
      Object.defineProperty(mockFile, 'size', { 
        value: result.fileSize,
        writable: false 
      });
      
      // Add all path properties to the mock file
      Object.defineProperty(mockFile, 'path', { 
        value: result.absolutePath,
        writable: false 
      });
      Object.defineProperty(mockFile, 'webkitRelativePath', { 
        value: result.absolutePath,
        writable: false 
      });
      
      // Add custom path properties for display
      (mockFile as any).absolutePath = result.absolutePath;
      (mockFile as any).fullPath = result.absolutePath;
      (mockFile as any).filePath = result.absolutePath;

      console.log('📁 Created mock file with paths:', {
        name: mockFile.name,
        size: mockFile.size,
        path: (mockFile as any).path,
        absolutePath: (mockFile as any).absolutePath
      });

      // Add to UI file list (in-memory only)
      const fileList = [mockFile];
      Object.defineProperty(fileList, 'item', {
        value: (index: number) => index < fileList.length ? fileList[index] : null
      });
      
      addFiles(fileList as any);

      toast.success(`File selected: ${result.fileName}`, {
        duration: 2000
      });

      console.log('✅ File added to session successfully');

    } catch (error) {
      console.error('❌ File selection error:', error);
      toast.error('Failed to select file - please try again', {
        duration: 3000,
        style: { zIndex: 9999 }
      });
    } finally {
      setIsUploading(false);
      console.log('📁 File selection process completed');
    }
  }, [addFiles, isUploading]);

  // Enhanced remove file function with session cleanup
  const handleRemoveFile = useCallback((fileId: string) => {
    const fileToRemove = files.find(f => f.id === fileId);
    if (fileToRemove) {
      removeFile(fileId);
      
      // Remove from session storage
      try {
        const sessionFiles = JSON.parse(sessionStorage.getItem('osslab_session_files') || '[]') as SessionFileData[];
        const updatedSessionFiles = sessionFiles.filter((f: SessionFileData) => f.name !== fileToRemove.name);
        sessionStorage.setItem('osslab_session_files', JSON.stringify(updatedSessionFiles));
        console.log('🗑️ Removed file from session:', fileToRemove.name);
      } catch (error) {
        console.error('Failed to remove file from session:', error);
      }
    }
  }, [files, removeFile]);

  // Enhanced clear all function with session cleanup
  const handleClearAllFiles = useCallback(() => {
    clearFiles();
    
    // Clear session storage
    try {
      sessionStorage.removeItem('osslab_session_files');
      console.log('🗑️ Cleared all session files');
    } catch (error) {
      console.error('Failed to clear session files:', error);
    }

    toast.info('All files cleared from session');
  }, [clearFiles]);

  // Helper function to get current session files for chat
  const getCurrentSessionFiles = useCallback((): SessionFileData[] => {
    try {
      return JSON.parse(sessionStorage.getItem('osslab_session_files') || '[]') as SessionFileData[];
    } catch (error) {
      console.error('Error reading session files:', error);
      return [];
    }
  }, []);

  // Expose session files getter to global scope for chat component access
  useEffect(() => {
    (window as any).getOSSLabSessionFiles = getCurrentSessionFiles;
    
    return () => {
      delete (window as any).getOSSLabSessionFiles;
    };
  }, [getCurrentSessionFiles]);

  // Auto-clear session on window unload
  useEffect(() => {
    const handleUnload = () => {
      sessionStorage.removeItem('osslab_session_files');
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  // Monitor session storage changes
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'osslab_session_files' && event.newValue === null) {
        // Session files were cleared, update UI
        if (files.length > 0) {
          clearFiles();
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [files.length, clearFiles]);

  return (
    <aside
      className={cn(
        'flex flex-col flex-shrink-0 z-40 transition-all duration-300',
        'bg-[var(--sidebar-bg)] border-r border-[var(--border-primary)]',
        isCollapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="p-4 flex items-center h-[70px] border-b border-[var(--border-primary)] flex-shrink-0">
        <svg className="w-8 h-8 text-[var(--sidebar-text)] flex-shrink-0" fill="none" viewBox="0 0 24 24">
          <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          <path d="M2 17L12 22L22 17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          <path d="M2 12L12 17L22 12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
        {!isCollapsed && (
          <div className="ml-3 flex-1">
            <span className="font-bold text-[var(--sidebar-text)] text-lg">OSSLAB</span>
            <div className="flex items-center gap-1 mt-1">
              {systemStats.isOnline ? (
                <Wifi size={10} className="text-green-500" />
              ) : (
                <WifiOff size={10} className="text-red-500" />
              )}
              <span className="text-xs text-[var(--sidebar-text-secondary)]">
                {systemStats.isOnline ? 'Backend Online' : 'Backend Offline'}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Navigation */}
        <nav className="flex-shrink-0 px-3 py-4 space-y-2">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex items-center px-3 py-2.5 rounded-lg transition-colors duration-200 text-sm font-medium',
                link.active
                  ? 'bg-[var(--sidebar-item-active)] text-[var(--sidebar-text)]'
                  : 'text-[var(--sidebar-text-secondary)] hover:bg-[var(--sidebar-item-hover)] hover:text-[var(--sidebar-text)]',
                isCollapsed && 'justify-center px-2'
              )}
            >
              <span className="material-symbols-outlined text-lg">{link.icon}</span>
              {!isCollapsed && <span className="ml-3">{link.label}</span>}
            </Link>
          ))}
        </nav>

        {/* Dataset Selection */}
        {!isCollapsed && (
          <div className="flex-1 flex flex-col min-h-0 px-3 py-4 border-t border-[var(--border-primary)]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[var(--sidebar-text)] flex-shrink-0">
                Dataset Files
              </h3>
              {files.length > 0 && (
                <button
                  onClick={handleClearAllFiles}
                  className="text-xs text-red-500 hover:text-red-600"
                  title="Clear all files"
                  disabled={isUploading}
                >
                  Clear All
                </button>
              )}
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              accept={ALLOWED_FILE_TYPES.map(ext => `.${ext}`).join(',')}
              disabled={!uploadEnabled || isUploading}
            />
            
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-3">
              <button
                onClick={handleFilesSelected}
                disabled={!uploadEnabled || isUploading}
                className={cn(
                  "w-full rounded-lg p-3 text-center flex items-center justify-center gap-2 transition-colors font-medium text-sm",
                  isUploading
                    ? "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] cursor-not-allowed"
                    : "bg-[var(--cyan-accent)] hover:bg-[var(--cyan-accent)]/80 text-black cursor-pointer"
                )}
                style={{ zIndex: 1 }}
              >
                {isUploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span className="select-none">Selecting...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">upload_file</span>
                    <span className="select-none">Select Datasets</span>
                  </>
                )}
              </button>
              
              {files.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-[var(--sidebar-text-secondary)] font-medium">
                    {files.length} dataset(s) ready for analysis
                  </div>
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-yellow-500 text-sm">info</span>
                      <span className="text-xs text-yellow-600 dark:text-yellow-400">
                        Files will be cleared after sending message
                      </span>
                    </div>
                  </div>
                  {files.map(file => (
                    <FileItem
                      key={file.id}
                      file={file}
                      onRemove={handleRemoveFile}
                    />
                  ))}
                </div>
              )}

              {files.length === 0 && (
                <div className="text-center text-[var(--sidebar-text-secondary)] text-sm py-8">
                  <FileSpreadsheet size={32} className="mx-auto mb-2 opacity-50" />
                  <p>No datasets selected</p>
                  <p className="text-xs mt-1">Select files to start analysis</p>
                  <div className="mt-3 text-xs bg-blue-500/10 border border-blue-500/20 rounded p-2">
                    <span className="text-blue-600 dark:text-blue-400">
                      💡 Files are session-only and cleared after each message
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* System Monitor */}
        {!isCollapsed && (
          <div className="px-3 py-4 border-t border-[var(--border-primary)] text-[var(--sidebar-text)] flex-shrink-0">
            <h3 className="text-sm font-semibold mb-3">System Monitor</h3>
            <div className="grid grid-cols-2 gap-2 text-center">
              <StatCard 
                label="CPU" 
                value={`${systemStats.cpu}%`} 
                icon={Cpu}
                color={systemStats.cpu > 80 ? 'text-red-500' : systemStats.cpu > 60 ? 'text-yellow-500' : 'text-green-500'}
              />
              <StatCard 
                label="RAM" 
                value={`${systemStats.memory}%`} 
                icon={MemoryStick}
                color={systemStats.memory > 80 ? 'text-red-500' : systemStats.memory > 60 ? 'text-yellow-500' : 'text-green-500'}
              />
              <StatCard 
                label="GPU" 
                value={`${systemStats.gpu}%`} 
                icon={Activity}
                color={systemStats.gpu > 80 ? 'text-red-500' : systemStats.gpu > 60 ? 'text-yellow-500' : 'text-green-500'}
              />
              <StatCard 
                label="Network" 
                value={`${systemStats.networkUsage} KB/s`} 
                icon={Globe}
                color="text-[var(--cyan-accent)]"
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Section - Profile button removed */}
      <div className="px-3 py-4 border-t border-[var(--border-primary)] space-y-1 text-[var(--sidebar-text-secondary)] flex-shrink-0">
        <Link
          href="/settings"
          className={cn(
            'flex items-center px-3 py-2 rounded-lg transition-colors text-sm hover:bg-[var(--sidebar-item-hover)] hover:text-[var(--sidebar-text)]',
            isCollapsed && 'justify-center'
          )}
        >
          <span className="material-symbols-outlined text-lg">settings</span>
          {!isCollapsed && <span className="ml-3">Settings</span>}
        </Link>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center px-3 py-2 hover:text-[var(--sidebar-text)] transition-colors text-sm"
        >
          <span
            className={cn(
              'material-symbols-outlined text-lg transition-transform',
              isCollapsed && 'rotate-180'
            )}
          >
            chevron_left
          </span>
          {!isCollapsed && <span className="ml-3">Collapse</span>}
        </button>
      </div>
    </aside>
  );
};

export default OSSLABSidebar;
