import { NextResponse } from 'next/server';

const PYTHON_BACKEND = 'http://127.0.0.1:8000';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const response = await fetch(`${PYTHON_BACKEND}/api/conversation/${id}`);
    if (!response.ok) return NextResponse.json({ message: 'Chat not found' }, { status: 404 });
    const data = await response.json();
    return NextResponse.json({ chat: data, messages: data.chat_history || [] });
  } catch (error) {
    return NextResponse.json({ message: 'Error occurred' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const response = await fetch(`${PYTHON_BACKEND}/api/conversation/${id}`, { method: 'DELETE' });
    return response.ok 
      ? NextResponse.json({ message: 'Chat deleted successfully' })
      : NextResponse.json({ message: 'Chat not found' }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ message: 'Error occurred' }, { status: 500 });
  }
}
