// src/lib/agents/resultAgent.ts
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { eq } from 'drizzle-orm';
import db from '@/lib/db';
import { agentSessions, messages as messagesSchema } from '@/lib/db/schema';
/**
 * Handles final result generation and presentation
 * @param step The agent step containing the result data
 * @param chatId The current chat session ID
 * @param sendEvent Function to send events to the client
 * @returns The final user-facing result
 */
export async function handleResultStep(
  step: any,
  chatId: string,
  sendEvent: (data: object) => void
) {
  sendEvent({ type: 'status_update', message: 'Generating final result...' });
  
  try {
    // Extract the result data
    const resultData = step.result || step.output || '';
    
    // Check if there were any errors in previous steps
    const session = await db.query.agentSessions.findFirst({
      where: eq(agentSessions.id, chatId)
    });
    
    // If there was a file reading error, provide specific guidance
    if (session?.hasFileReadingError) {
      return {
        output: "I couldn't read your dataset file. Please reupload it in CSV format and try again.",
        status: "error"
      };
    }
    
    // Generate a user-friendly summary
    return {
      output: `Here's what I found: ${resultData}`,
      status: "success"
    };
  } catch (error) {
    console.error('Result handling error:', error);
    return {
      output: "Failed to generate final result. Please try again.",
      status: "error"
    };
  }
}