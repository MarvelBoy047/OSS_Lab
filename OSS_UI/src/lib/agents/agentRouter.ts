// src/lib/agents/agentRouter.ts
import { BaseMessage } from '@langchain/core/messages';
import { ContextManager, AgentContext } from './contextManager';
import formatChatHistoryAsString from '@/lib/utils/formatHistory';
import { runInitialAnalysisAgent } from './initialAnalysisAgent';
import { runNotebookCodingAgent } from './notebookAgent';
import { runPresentationAgent } from './presentationAgent';
import db from '@/lib/db';
import { messages as messagesSchema } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function routeAgent(
  chatId: string,
  prompt: string,
  history: BaseMessage[],
  sendEvent: (data: object) => void
) {
  const contextManager = new ContextManager(chatId);
  const currentContext = await contextManager.getContext();
  
  // Convert history to searchable string
  const historyText = formatChatHistoryAsString(history);
  const historyTextLower = historyText.toLowerCase();
  
  switch (currentContext) {
    case AgentContext.DEFAULT:
      // Check if we need to switch contexts based on user input
      if (historyTextLower.includes('analyze') || 
          historyTextLower.includes('file') ||
          historyTextLower.includes('dataset')) {
        await runInitialAnalysisAgent(chatId, prompt, history, sendEvent);
      } else {
        // Handle general conversation
        const defaultMessage = "I'm ready to assist. You can ask me to analyze a file, generate a notebook, or create a presentation from an analysis.";
        await db.insert(messagesSchema).values({
          chatId,
          messageId: crypto.randomUUID(),
          role: 'assistant',
          content: defaultMessage,
          meta: '{}'  // CORRECTED: This is the exact field name in your schema
        });
        sendEvent({ type: 'final_response', content: defaultMessage });
      }
      break;
      
    case AgentContext.NOTEBOOK:
      await runNotebookCodingAgent(chatId, history, sendEvent);
      break;
      
    case AgentContext.PRESENTATION:
      await runPresentationAgent(chatId, history, sendEvent);
      break;
      
    default:
      await runInitialAnalysisAgent(chatId, prompt, history, sendEvent);
  }
}