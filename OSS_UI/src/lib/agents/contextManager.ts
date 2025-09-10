// src/lib/agents/contextManager.ts
import { eq } from 'drizzle-orm';
import db from '@/lib/db';
import { agentSessions, notebookCells, presentationSlides } from '@/lib/db/schema';

export enum AgentContext {
  DEFAULT = 'default',
  NOTEBOOK = 'notebook',
  PRESENTATION = 'presentation',
  PYTHON_EXECUTION = 'python_execution'
}

export class ContextManager {
  private chatId: string;
  
  constructor(chatId: string) {
    this.chatId = chatId;
  }
  
  async setContext(context: AgentContext): Promise<void> {
    await db.update(agentSessions)
      .set({ currentContext: context })
      .where(eq(agentSessions.id, this.chatId));
  }
  
  async getContext(): Promise<AgentContext> {
    const session = await db.query.agentSessions.findFirst({
      where: eq(agentSessions.id, this.chatId)
    });
    
    return (session?.currentContext as AgentContext) || AgentContext.DEFAULT;
  }
  
  async switchToNotebook(): Promise<void> {
    await this.setContext(AgentContext.NOTEBOOK);
    // Clear any notebook-specific context
    await db.delete(notebookCells).where(eq(notebookCells.chatId, this.chatId));
  }
  
  async switchToPresentation(): Promise<void> {
    await this.setContext(AgentContext.PRESENTATION);
    // Clear any presentation-specific context
    await db.delete(presentationSlides).where(eq(presentationSlides.chatId, this.chatId));
  }
  
  async switchToDefault(): Promise<void> {
    await this.setContext(AgentContext.DEFAULT);
  }
  
  async isNotebookContext(): Promise<boolean> {
    return (await this.getContext()) === AgentContext.NOTEBOOK;
  }
  
  async isPresentationContext(): Promise<boolean> {
    return (await this.getContext()) === AgentContext.PRESENTATION;
  }
}