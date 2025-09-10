// src/app/api/presentations/[chatId]/download/route.ts
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { presentationSlides } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import pptxgen from "pptxgenjs";

interface SlideData {
    slide_number: number;
    type: 'title' | 'content' | 'chart' | 'conclusion';
    title?: string;
    subtitle?: string;
    bullets?: string[];
    content?: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { chatId: string } }
) {
  const { chatId } = params;
  const slidesData = await db.query.presentationSlides.findMany({
    where: eq(presentationSlides.chatId, chatId),
    orderBy: (slides, { asc }) => [asc(slides.slideNumber)],
  });

  if (!slidesData.length) {
    return new NextResponse('No slides found', { status: 404 });
  }

  let pres = new pptxgen();

  slidesData.forEach(slideEntry => {
    const data = slideEntry.slideData as SlideData;
    const slide = pres.addSlide();

    if (data.title) {
        slide.addText(data.title, { x: 0.5, y: 0.25, fontSize: 32, bold: true, w: '90%' });
    }
    if (data.subtitle) {
        slide.addText(data.subtitle, { x: 0.5, y: 0.75, fontSize: 20, w: '90%' });
    }
    if (data.bullets) {
        const bulletPoints = data.bullets.map(b => ({ text: b }));
        slide.addText(bulletPoints, { x: 0.5, y: 1.5, w: '90%', h: '75%', bullet: true, fontSize: 18 });
    }
    if (data.content) {
        slide.addText(data.content, { x: 0.5, y: 1.5, w: '90%', h: '75%', fontSize: 18 });
    }
  });

  const buffer = await pres.write({ outputType: 'arraybuffer' });

  // FIX: Pass the raw ArrayBuffer directly to the Response constructor.
  // This avoids the Node.js Buffer vs. Web API BodyInit type conflict.
  return new Response(buffer as ArrayBuffer, {
    status: 200,
    headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="presentation-${chatId}.pptx"`,
    },
  });
}