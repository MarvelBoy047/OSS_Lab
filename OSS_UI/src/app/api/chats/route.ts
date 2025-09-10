import { NextRequest, NextResponse } from 'next/server';

const PYTHON_BACKEND = 'http://127.0.0.1:8000';

export async function GET() {
  try {
    const response = await fetch(`${PYTHON_BACKEND}/api/conversations`);
    const data = await response.json();
    return NextResponse.json({ chats: data.conversations || [] });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get chats' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const response = await fetch(`${PYTHON_BACKEND}/api/chat/create`, { method: 'POST' });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create chat' }, { status: 500 });
  }
}
