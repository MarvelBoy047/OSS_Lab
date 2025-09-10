import { NextRequest, NextResponse } from 'next/server';

const PYTHON_BACKEND = 'http://127.0.0.1:8000';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const response = await fetch(`${PYTHON_BACKEND}/api/upload/reference_document`, {
      method: 'POST',
      body: formData
    });
    if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
    const data = await response.json();
    return NextResponse.json({ files: [data] });
  } catch (error) {
    return NextResponse.json({ message: 'Upload failed' }, { status: 500 });
  }
}
