// src/lib/agents/pythonExecutionAgent.ts
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { eq } from 'drizzle-orm';
import db from '@/lib/db';
import { agentSessions, messages as messagesSchema } from '@/lib/db/schema';
import { WindowsSandbox } from '@/lib/utils/windowsSandbox';

/**
 * Executes Python code in a Windows-compatible sandbox environment
 * @param step The agent step containing the Python code to execute
 * @param chatId The current chat session ID
 * @param sendEvent Function to send events to the client
 * @returns The execution result
 */
// Update the imports

// Replace the existing handlePythonExecutionStep function with this:
export async function handlePythonExecutionStep(
  step: any,
  chatId: string,
  sendEvent: (data: object) => void
) {
  sendEvent({ type: 'status_update', message: 'Executing Python code in Windows sandbox...' });
  
  const sandbox = new WindowsSandbox();
  
  try {
    await sandbox.setup();
    
    // Execute the code
    const { stdout, stderr } = await sandbox.executePython(
      step.input || step.query
    );
    
    // Check if this is a file reading operation
    const isFileReading = (step.input || step.query).includes('pd.read_csv') || 
                          (step.input || step.query).includes('open(') ||
                          (step.input || step.query).includes('with open(');
    
    if (stderr && stderr.trim()) {
      // If there's an error but we're in a file reading context, provide user-friendly message
      if (isFileReading) {
        return {
          output: "Failed to read the dataset. Please reupload the file or check the format.",
          status: "error",
          isFileReadingError: true
        };
      }
      return {
        output: `Error: ${stderr}`,
        status: "error"
      };
    }
    
    // Success response
    return {
      output: stdout,
      status: "success",
      ...(isFileReading && { 
        output: `File read successfully. Here are the first few rows:\n\n${stdout}` 
      })
    };
  } catch (error: any) {
    console.error('Python execution error:', error);
    
    // Check if this was a file reading operation
    const isFileReading = (step.input || step.query)?.includes('pd.read_csv') || false;
    
    // Always provide user-friendly message for file reading errors
    if (isFileReading || error.isFileReadingError) {
      return {
        output: "Failed to read the dataset. Please reupload the file or check the format.",
        status: "error"
      };
    }
    
    return {
      output: `Execution failed: ${error.error || error.message || 'Unknown error'}`,
      status: "error"
    };
  } finally {
    // Ensure sandbox is cleaned up even if there's an error
    await sandbox.cleanup();
  }
}