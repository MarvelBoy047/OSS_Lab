import { NextRequest, NextResponse } from 'next/server';

const PYTHON_BACKEND = 'http://127.0.0.1:8000';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    
    const response = await fetch(`${PYTHON_BACKEND}/api/upload/reference_document`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Attachment processing failed');
    }
    
    const data = await response.json();
    return NextResponse.json({ files: [data] });
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message || 'Attachment upload failed' }, { status: 500 });
  }
}
