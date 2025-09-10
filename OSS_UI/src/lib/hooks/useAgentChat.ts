// src/lib/hooks/useAgentChat.ts
'use client';
import { useState, useCallback } from 'react';
import { toast } from 'sonner';

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

function isAnalysisIntent(t: string) {
  return /\b(analy[sz]e|dataset|data|file|csv|table)\b/i.test(t);
}

export function useAgentChat(
  chatId: string = 'default',
  initialMessages: AgentMessage[] = []
) {
  const [messages, setMessages] = useState<AgentMessage[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [datasetChecking, setDatasetChecking] = useState(false);

  const sendMessage = useCallback(async (content: string) => {
    if (isLoading) return;
    const userMsg = { id: crypto.randomUUID(), role: 'user' as const, content };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    setStatusMessage('');

    const analysisIntent = isAnalysisIntent(content);

    try {
      const res = await fetch('/api/orchestrator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          prompt: content,
          history: messages.map(m => ({ role: m.role, content: m.content }))
        })
      });
      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          if (!raw.startsWith('data:')) continue;

          const jsonStr = raw.slice(5).trim();
          if (!jsonStr) continue;
          const event = JSON.parse(jsonStr);

          if (event.agent_dataset_check) {
            // Only show loader when this turn is analysis related
            if (analysisIntent) {
              setDatasetChecking(true);
              setStatusMessage(event.agent_dataset_check.message);
            }
          } else if (event.agent_dataset_status) {
            setDatasetChecking(false);
            if (analysisIntent) {
              const st = event.agent_dataset_status;
              if (st.found) {
                assistantText += `✅ Files: ${st.files.join(', ')}\n`;
              } else {
                // keep quiet if no files; no nagging
                // optional: assistant can still add a one-line tip later
              }
            }
          } else if (event.type === 'status_update') {
            setStatusMessage(event.message);
          } else if (event.type === 'final_response') {
            assistantText += event.content;
          } else if (event.type === 'error') {
            toast.error(event.message);
            assistantText += `Error: ${event.message}`;
          }
        }
      }

      setMessages(prev => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: assistantText.trim() }
      ]);
    } catch (err: any) {
      toast.error(err.message);
      setMessages(prev => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: `Error: ${err.message}` }
      ]);
    } finally {
      setIsLoading(false);
      setStatusMessage('');
      setDatasetChecking(false);
    }
  }, [chatId, messages, isLoading]);

  return { messages, isLoading, statusMessage, datasetChecking, sendMessage };
}
