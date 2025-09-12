// src/lib/config/windowsConfig.ts
import path from 'path';

/**
 * Returns the appropriate path for Windows sandboxing
 */
export function getSandboxBasePath(): string {
  // On Windows, use a path that doesn't have spaces or special characters
  const baseDir = process.env.SANDBOX_BASE_DIR || 
                 (process.platform === 'win32' ? 'C:\\OSS_LABSandbox' : '/tmp/OSS_LAB-sandbox');
  
  return baseDir;
}

export function isWindows(): boolean {
  return process.platform === 'win32';
}