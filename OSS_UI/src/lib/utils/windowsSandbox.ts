// src/lib/utils/windowsSandbox.ts
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

/**
 * Returns the correct sandbox path for the current platform
 */
export function getSandboxPath(): string {
  if (process.platform === 'win32') {
    // Windows path
    return path.join('C:', 'OSS_LABSandbox', uuidv4());
  } else {
    // Unix-like path
    return path.join('/tmp', 'OSS_LAB-sandbox', uuidv4());
  }
}

/**
 * Creates the sandbox directory if it doesn't exist
 */
export async function ensureSandboxPath(sandboxPath: string): Promise<void> {
  try {
    await fs.promises.mkdir(sandboxPath, { recursive: true });
  } catch (error) {
    console.error('Error creating sandbox directory:', error);
    throw new Error('Failed to create sandbox directory');
  }
}