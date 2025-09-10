import { NextRequest, NextResponse } from 'next/server';

const PYTHON_BACKEND = 'http://127.0.0.1:8000';

export async function POST(req: NextRequest) {
  try {
    const { chatId, prompt, history } = await req.json();
    const response = await fetch(`${PYTHON_BACKEND}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message: prompt })
    });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Orchestrator failed' }, { status: 500 });
  }
}
