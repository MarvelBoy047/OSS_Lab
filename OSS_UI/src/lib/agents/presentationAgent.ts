import db from '@/lib/db';
import { presentationSlides, notebookCells, messages as messagesSchema, agentSessions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAvailableChatModelProviders } from '@/lib/providers';

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function resolveLLM(chatId: string) {
  const session = await db.query.agentSessions.findFirst({ where: eq(agentSessions.id, chatId) });
  if (!session?.providerKey || !session?.modelKey) throw new Error('No model selected for this session.');
  const providers = await getAvailableChatModelProviders();
  const provider = providers[session.providerKey];
  const modelInfo = provider?.[session.modelKey];
  if (!modelInfo) throw new Error(`Model '${session.modelKey}' not found in provider '${session.providerKey}'.`);
  return modelInfo.model as any;
}

export async function runPresentationAgent(
  chatId: string,
  _history: any[],
  sendEvent: (data: object) => void
) {
  let llm: any;
  try {
    llm = await resolveLLM(chatId);
  } catch (e: any) {
    const msg = `Presentation Agent cannot start: ${e.message}`;
    sendEvent({ type: 'error', message: msg });
    await db.insert(messagesSchema).values({
      chatId,
      messageId: newId(),
      content: msg,
      role: 'assistant',
      meta: JSON.stringify({ createdAt: new Date() })
    });
    return;
  }

  const cells = await db.query.notebookCells.findMany({
    where: eq(notebookCells.chatId, chatId),
    orderBy: (t, { asc }) => [asc(t.cellNumber)]
  });
  const contextString = cells.map(c => `### Cell ${c.cellNumber} (${c.type})\n${c.content}`).join('\n\n');

  const systemInstructions = `Create a presentation summarizing the analysis.
Return exactly one JSON object per turn: {"slide": { type: "title"|"content"|"chart"|"conclusion", title?: string, subtitle?: string, bullets?: string[], content?: string }}
Stop after emitting a slide with type "conclusion". No extra text.`;

  let concluded = false;
  let slideNumber = 1;

  while (!concluded && slideNumber <= 15) {
    sendEvent({ type: 'status_update', message: `Presentation Agent: Generating slide ${slideNumber}...` });

    const existing = await db.query.presentationSlides.findMany({
      where: eq(presentationSlides.chatId, chatId),
      orderBy: (t, { asc }) => [asc(t.slideNumber)]
    });
    const history = existing.map(s => `// Slide #${s.slideNumber}\n${JSON.stringify(s.slideData)}`).join('\n');

    const prompt = `${systemInstructions}
---
NOTEBOOK CONTEXT:
${contextString}
---
EXISTING SLIDES:
${history}
---
Next slide JSON only:`;

    const resp = await llm.invoke(prompt);

    let slideObj: any;
    try {
      const raw = resp.content.toString();
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON object found');
      const parsed = JSON.parse(match);
      if (!parsed?.slide || typeof parsed.slide !== 'object') throw new Error('Missing "slide" object');
      slideObj = parsed.slide;
    } catch (err: any) {
      sendEvent({ type: 'error', message: `Agent returned invalid slide JSON (${err.message}), retrying.` });
      await new Promise(res => setTimeout(res, 1200));
      continue;
    }

    const newSlide = { chatId, slideNumber, slideData: slideObj };
    await db.insert(presentationSlides).values(newSlide);
    sendEvent({ type: 'presentation_slide_added', slide: newSlide });

    if (slideObj.type === 'conclusion') concluded = true;
    slideNumber++;
  }

  const finalMessage = "I've created the presentation based on the analysis. Use the download button to export the .pptx.";
  await db.insert(messagesSchema).values({
    chatId,
    messageId: newId(),
    content: finalMessage,
    role: 'assistant',
    meta: JSON.stringify({ createdAt: new Date() })
  });
  sendEvent({ type: 'final_response', content: finalMessage });
}
