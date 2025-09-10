// src/lib/agents/webSearchAgent.ts
import { searchSearxng } from '@/lib/searxng';
import { eq } from 'drizzle-orm';
import db from '@/lib/db';
import { agentSessions } from '@/lib/db/schema';

/**
 * Handles web search requests from the agent
 * @param step The agent step containing the search query
 * @param chatId The current chat session ID
 * @param sendEvent Function to send events to the client
 * @returns The search results
 */
export async function handleWebSearchStep(
  step: any,
  chatId: string,
  sendEvent: (data: object) => void
) {
  sendEvent({ type: 'status_update', message: 'Performing web search...' });
  
  try {
    // Extract the query from the step
    const query = step.query || step.input || '';
    
    // Perform the search
    const searchResults = await searchSearxng(query);
    
    // Format the results for the agent
    const formattedResults = searchResults.results.slice(0, 5).map(result => 
      `Title: ${result.title || 'No title'}\nURL: ${result.url || 'No URL'}\nContent: ${result.content ? result.content.substring(0, 300) + '...' : 'No content available'}`
    ).join('\n\n');
    
    // Store search results in session for context
    await db.update(agentSessions)
      .set({ 
        searchResults: formattedResults 
      })
      .where(eq(agentSessions.id, chatId));
    
    return {
      output: formattedResults,
      status: "success",
      results: searchResults.results
    };
  } catch (error) {
    console.error('Web search error:', error);
    return {
      output: "Failed to perform web search. Please try again.",
      status: "error"
    };
  }
}