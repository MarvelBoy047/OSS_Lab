import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { agentSessions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const POST = async (req: NextRequest) => {
  try {
    const { providerKey, modelKey, chatId, scope = 'all' } = await req.json() as {
      providerKey: string;
      modelKey: string;
      chatId?: string;
      scope?: 'all' | 'single';
    };

    if (!providerKey || !modelKey) {
      return NextResponse.json({ error: 'providerKey and modelKey required' }, { status: 400 });
    }

    if (scope === 'single' && !chatId) {
      return NextResponse.json({ error: 'chatId required for scope=single' }, { status: 400 });
    }

    if (scope === 'single' && chatId) {
      // Upsert single session
      const existing = await db.query.agentSessions.findFirst({ where: eq(agentSessions.id, chatId) });
      if (existing) {
        await db.update(agentSessions).set({ providerKey, modelKey }).where(eq(agentSessions.id, chatId)).execute();
      } else {
        await db.insert(agentSessions).values({
          id: chatId,
          activeAgent: 'orchestrator',
          currentContext: 'default',
          analysisPlan: '',
          hasFileReadingError: 0,
          providerKey,
          modelKey
        }).execute();
      }
    } else {
      // Update all rows (best-effort)
      await db.update(agentSessions).set({ providerKey, modelKey }).execute();
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('agent-session update failed:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
};
