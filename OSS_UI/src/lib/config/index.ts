// Add this import
import { getSandboxBasePath, isWindows } from './windowsConfig';

// Add these functions
export function getSandboxBasePath(): string {
  if (isWindows()) {
    return getWindowsSandboxPath();
  }
  return '/tmp/OSS_LAB-sandbox';
}

export function isProductionWindows(): boolean {
  return isWindows() && process.env.NODE_ENV === 'production';
}