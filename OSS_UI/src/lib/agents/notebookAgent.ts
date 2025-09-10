// src/lib/agents/notebookAgent.ts
import db from '@/lib/db';
import { agentSessions, notebookCells, messages as messagesSchema } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAvailableChatModelProviders } from '@/lib/providers';

async function resolveLLM(chatId: string) {
  const session = await db.query.agentSessions.findFirst({ where: eq(agentSessions.id, chatId) });
  if (!session?.providerKey || !session?.modelKey) throw new Error('No model selected for this session.');
  const providers = await getAvailableChatModelProviders();
  const provider = providers[session.providerKey];
  const modelInfo = provider?.[session.modelKey];
  if (!modelInfo) throw new Error(`Model '${session.modelKey}' not found in provider '${session.providerKey}'.`);
  return modelInfo.model;
}

export async function runNotebookCodingAgent(
  chatId: string,
  _history: any[],
  sendEvent: (data: object) => void
) {
  let llm: any;
  try {
    llm = await resolveLLM(chatId);
  } catch (e: any) {
    const msg = `Notebook Agent cannot start: ${e.message}`;
    sendEvent({ type: 'error', message: msg });
    await db.insert(messagesSchema).values({ chatId, messageId: crypto.randomUUID(), content: msg, role: 'assistant', meta: JSON.stringify({ createdAt: new Date() }) });
    return;
  }

  const session = await db.query.agentSessions.findFirst({ where: eq(agentSessions.id, chatId) });
  const taskList = session?.analysisPlan || 'No plan provided. Proceed with general analysis.';
  const systemInstructions = `Create a data analysis notebook step by step.
Task list: ${taskList}
Return exactly one JSON object per turn representing the next cell:
- {"markdown": "..."} or {"code": "..."} or {"conclusion": "..."}
Do not include extra text.`;

  let concluded = false;
  let stepNumber = 1;

  while (!concluded && stepNumber <= 20) {
    sendEvent({ type: 'status_update', message: `Coding Agent: Generating cell ${stepNumber}...` });

    const existing = await db.query.notebookCells.findMany({
      where: eq(notebookCells.chatId, chatId),
      orderBy: (cells, { asc }) => [asc(cells.cellNumber)]
    });
    const memory = existing.map(c => `// Cell #${c.cellNumber} (${c.type})\n${c.content}`).join('\n\n');

    const turnPrompt = `${systemInstructions}\n---\nMEMORY:\n${memory}\n---\nNext cell JSON only:`;

    const response = await llm.invoke(turnPrompt);
    let cellJson: any;
    try {
      const raw = response.content.toString();
      const match = raw.match(/\{[\s\S]*\}/)?.[0];
      if (!match) throw new Error('No JSON object found in LLM response');
      cellJson = JSON.parse(match);
    } catch {
      sendEvent({ type: 'error', message: 'Agent returned invalid JSON, retrying.' });
      await new Promise(res => setTimeout(res, 1200));
      continue;
    }
    const cellType = Object.keys(cellJson)[0];
    const cellContent = cellJson[cellType as keyof typeof cellJson];

    if (cellType !== 'code' && cellType !== 'markdown' && cellType !== 'conclusion') {
      sendEvent({ type: 'error', message: `Unknown cell type: ${cellType}` });
      continue;
    }

    const newCell = {
      chatId,
      cellNumber: stepNumber,
      type: cellType as 'code' | 'markdown' | 'conclusion',
      content: String(cellContent)
    };

    await db.insert(notebookCells).values(newCell);
    sendEvent({ type: 'notebook_cell_added', cell: newCell });

    if (cellType === 'conclusion') concluded = true;
    stepNumber++;
  }

  const finalMessage = "I've completed the analysis. You can now review the generated notebook.";
  await db.insert(messagesSchema).values({
    chatId,
    messageId: crypto.randomUUID(),
    content: finalMessage,
    role: 'assistant',
    meta: JSON.stringify({ createdAt: new Date() })
  });
  sendEvent({ type: 'final_response', content: finalMessage });
}
