// src/lib/agents/initialAnalysisAgent.ts
import { BaseMessage, AIMessage, HumanMessage } from '@langchain/core/messages';
import db from '@/lib/db';
import { agentSessions, chats as chatsTable, messages as messagesSchema } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAvailableChatModelProviders } from '@/lib/providers';

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function resolveLLM(chatId: string) {
  const session = await db.query.agentSessions.findFirst({ where: eq(agentSessions.id, chatId) });
  if (!session?.providerKey || !session?.modelKey) throw new Error('No provider/model set in Settings for this chat.');
  const providers = await getAvailableChatModelProviders();
  const provider = providers[session.providerKey];
  if (!provider) throw new Error(`Provider '${session.providerKey}' not available.`);
  const modelInfo = provider[session.modelKey];
  if (!modelInfo) throw new Error(`Model '${session.modelKey}' not found in provider '${session.providerKey}'.`);
  return { llm: modelInfo.model, providerKey: session.providerKey, modelKey: session.modelKey };
}

async function getChatFilesInfo(chatId: string) {
  const chat = await db.query.chats.findFirst({ where: eq(chatsTable.id, chatId) });
  const files = (chat?.files ?? []) as Array<{ name: string; fileId: string }>;
  return { hasFiles: files.length > 0, fileNames: files.map(f => f.name) };
}

function maybeAddGentleTip(promptLower: string, hasFiles: boolean) {
  const wantsAnalysis = /\b(analy[sz]e|dataset|data|file|csv|table)\b/.test(promptLower);
  return !hasFiles && wantsAnalysis
    ? '\n\nTip: Use “Upload Files” in the sidebar when ready — I’ll pick them up automatically next turn.'
    : '';
}

function calmGuard(text: string) {
  const patterns = [
    /please upload[^.]*\./gi,
    /upload (your )?(file|dataset)[^.]*\./gi,
    /i need (the )?(file|dataset)[^.]*\./gi,
    /cannot proceed[^.]*\./gi,
  ];
  let out = text;
  for (const p of patterns) out = out.replace(p, '').trim();
  return out.replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
}

export async function runInitialAnalysisAgent(
  chatId: string,
  prompt: string,
  history: BaseMessage[],
  sendEvent: (object: any) => void
) {
  try {
    const { llm, providerKey, modelKey } = await resolveLLM(chatId);
    await db.update(agentSessions).set({ activeAgent: 'initial_analysis', providerKey, modelKey }).where(eq(agentSessions.id, chatId));

    const { hasFiles, fileNames } = await getChatFilesInfo(chatId);
    const promptLower = String(prompt || '').toLowerCase();

    const systemPrompt = [
      'You are a calm, helpful data assistant.',
      '- Keep replies short and helpful; no long intros or disclaimers.',
      '- Never demand uploads; proceed with what’s available.',
      '- If files exist, acknowledge briefly and suggest next steps (1-2 lines).',
      '- If no files, answer normally; only add a single short tip if the user explicitly asked to analyze data.',
      `Files available now: ${hasFiles ? fileNames.join(', ') : 'None'}`
    ].join('\n');

    sendEvent({ type: 'status_update', message: 'Thinking...' });

    // Use the exact message objects provided by orchestrator
    const formatted: BaseMessage[] = [new HumanMessage(systemPrompt), ...history, new HumanMessage(prompt)];
    const resp = await llm.invoke(formatted);
    let text = resp.content.toString();
    text = calmGuard(text) + maybeAddGentleTip(promptLower, hasFiles);

    await db.insert(messagesSchema).values({
      chatId,
      messageId: newId(),
      role: 'assistant',
      content: text,
      meta: JSON.stringify({ createdAt: new Date() })
    });

    sendEvent({ type: 'final_response', content: text });
  } catch (err: any) {
    const msg = `Model error: ${err.message}`;
    sendEvent({ type: 'error', message: msg });
    await db.insert(messagesSchema).values({
      chatId,
      messageId: newId(),
      role: 'assistant',
      content: msg,
      meta: JSON.stringify({ createdAt: new Date() })
    });
  } finally {
    await db.update(agentSessions).set({ activeAgent: 'orchestrator' }).where(eq(agentSessions.id, chatId));
  }
}
