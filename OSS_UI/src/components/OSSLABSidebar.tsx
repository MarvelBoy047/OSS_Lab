'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { useSelectedLayoutSegments } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface UploadedFile {
  fileName: string;
  fileId: string;
  status: 'uploading' | 'completed' | 'error';
}

interface OSSLABSidebarProps {
  uploadEnabled: boolean;
}

const OSSLABSidebar: React.FC<OSSLABSidebarProps> = ({ uploadEnabled }) => {
  const segments = useSelectedLayoutSegments();
  const firstSegment = segments[0] ?? null;

  const navLinks = [
    { icon: 'dashboard', href: '/', label: 'Dashboard', active: firstSegment === null || firstSegment === 'dashboard' },
    { icon: 'explore', href: '/discover', label: 'Discover', active: segments.includes('discover') },
    { icon: 'book', href: '/library', label: 'Library', active: segments.includes('library') }
  ];

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const allowed = ['csv', 'json', 'xlsx'];
    const bad = Array.from(files).find(
      (f) => !allowed.includes(f.name.split('.').pop()?.toLowerCase() || '')
    );
    if (bad) {
      toast.error('Only .csv, .json, .xlsx files are supported for datasets.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploading(true);
    const formData = new FormData();
    Array.from(files).forEach(file => formData.append('files', file));

    try {
      const res = await fetch('/api/uploads', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload failed');
      
      const newFiles: UploadedFile[] = data.files.map((f: any) => ({
        fileName: f.name,
        fileId: f.id,
        status: 'completed'
      }));

      setUploadedFiles(prev => [...prev, ...newFiles]);
      toast.success(`Uploaded ${newFiles.length} dataset(s).`);

    } catch (err: any) {
      toast.error(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const removeFile = (fileId: string) => setUploadedFiles((prev) => prev.filter((f) => f.fileId !== fileId));

  return (
    <aside
      className={cn(
        'flex flex-col flex-shrink-0 z-50 transition-all duration-300',
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
        {!isCollapsed && <span className="ml-3 font-bold text-[var(--sidebar-text)] text-lg">OSSLAB</span>}
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

        {/* Upload Datasets */}
        {!isCollapsed && (
          <div className="flex-1 flex flex-col min-h-0 px-3 py-4 border-t border-[var(--border-primary)]">
            <h3 className="text-sm font-semibold text-[var(--sidebar-text)] mb-3 flex-shrink-0">Upload Datasets</h3>
            <input
              id="datasets-file-input"
              type="file"
              ref={fileInputRef}
              className="hidden"
              multiple
              accept=".csv,.json,.xlsx"
              onChange={handleFilesSelected}
              disabled={!uploadEnabled}
            />
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || !uploadEnabled}
                className="w-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg p-3 text-center flex items-center justify-center gap-2 transition-colors disabled:opacity-50 text-[var(--sidebar-text)]"
              >
                {uploading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-lg">upload_file</span>
                )}
                <span className="text-sm font-medium select-none">
                  {uploading ? 'Uploading…' : 'Upload Datasets'}
                </span>
              </button>
              
              {uploadedFiles.length > 0 && uploadedFiles.map((file) => (
                <div key={file.fileId} className="flex items-center gap-3 p-2 bg-[var(--bg-secondary)] rounded-lg">
                  <div
                    className={cn(
                      'w-6 h-6 rounded flex items-center justify-center flex-shrink-0',
                      file.status === 'completed'
                        ? 'bg-green-600'
                        : file.status === 'error'
                        ? 'bg-red-600'
                        : 'bg-blue-600 animate-pulse'
                    )}
                  >
                    {file.status === 'completed' && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {file.status === 'error' && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    {file.status === 'uploading' && (
                      <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate text-[var(--sidebar-text)]">{file.fileName}</div>
                    <div className="text-xs text-[var(--sidebar-text-secondary)]">
                      {file.status === 'completed' ? 'Ready' : file.status === 'error' ? 'Failed' : 'Processing...'}
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(file.fileId)}
                    className="text-[var(--sidebar-text-secondary)] hover:text-red-500 p-1"
                    title="Remove file"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* System Monitor */}
        {!isCollapsed && (
          <div className="px-3 py-4 border-t border-[var(--border-primary)] text-[var(--sidebar-text)] flex-shrink-0">
            <h3 className="text-sm font-semibold mb-3">System Monitor</h3>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-[var(--bg-secondary)] rounded-lg p-2">
                <p className="text-xs text-[var(--sidebar-text-secondary)]">CPU</p>
                <p className="text-sm font-bold">15%</p>
              </div>
              <div className="bg-[var(--bg-secondary)] rounded-lg p-2">
                <p className="text-xs text-[var(--sidebar-text-secondary)]">RAM</p>
                <p className="text-sm font-bold">8.2 GB</p>
              </div>
              <div className="bg-[var(--bg-secondary)] rounded-lg p-2">
                <p className="text-xs text-[var(--sidebar-text-secondary)]">GPU</p>
                <p className="text-sm font-bold">24%</p>
              </div>
              <div className="bg-[var(--bg-secondary)] rounded-lg p-2">
                <p className="text-xs text-[var(--sidebar-text-secondary)]">Storage</p>
                <p className="text-sm font-bold">256 GB</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Section */}
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
        <Link
          href="/profile"
          className={cn(
            'flex items-center px-3 py-2 rounded-lg transition-colors text-sm hover:bg-[var(--sidebar-item-hover)] hover:text-[var(--sidebar-text)]',
            isCollapsed && 'justify-center'
          )}
        >
          <span className="material-symbols-outlined text-lg">person</span>
          {!isCollapsed && <span className="ml-3">Profile</span>}
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
