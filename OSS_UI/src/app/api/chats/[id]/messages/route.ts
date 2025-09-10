// src/app/api/chats/[id]/messages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { messages as messagesSchema } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: chatId } = params;
    const { messageId, content, role, sources } = await req.json();

    if (!chatId || !messageId || !content || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await db.insert(messagesSchema).values({
      chatId,
      messageId,
      content,
      role,
      metadata: JSON.stringify({
        createdAt: new Date(),
        ...(sources && sources.length > 0 && { sources }),
      }),
    }).execute();

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: any) {
    console.error('Error saving message:', error);
    return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
  }
}