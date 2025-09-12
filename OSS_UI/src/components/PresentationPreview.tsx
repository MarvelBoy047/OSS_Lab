// src/components/PresentationPreview.tsx
'use client';
import { PresentationSlide } from '@/lib/hooks/useAgentChat';

interface PresentationPreviewProps {
    slides: PresentationSlide[];
    chatId: string;
}

const PresentationPreview = ({ slides, chatId }: PresentationPreviewProps) => {
    return (
        <div className="p-6 overflow-y-auto h-full bg-bg-primary text-text-primary">
            <div className="flex justify-between items-center mb-6 border-b border-input-border pb-4">
                <h1 className="text-3xl font-bold">Presentation Preview</h1>
                <a
                    href={`/api/presentations/${chatId}/download`}
                    download
                    className="bg-cyan-accent text-black font-bold py-2 px-4 rounded-lg hover:bg-opacity-80 transition-colors"
                >
                    Download .pptx
                </a>
            </div>
            <div className="space-y-6">
                {slides.map(slide => (
                    <div key={slide.slideData.slide_number} className="border border-input-border rounded-lg shadow-lg overflow-hidden">
                         <div className="p-2 bg-bg-tertiary text-xs text-text-secondary">Slide #{slide.slideData.slide_number}</div>
                        <div className="p-8 aspect-video bg-bg-secondary flex flex-col justify-center">
                            <h2 className="text-3xl font-semibold text-center">{slide.slideData.title}</h2>
                            {slide.slideData.subtitle && <p className="text-xl text-center mt-2 text-text-secondary">{slide.slideData.subtitle}</p>}
                            {slide.slideData.bullets && (
                                <ul className="list-disc pl-12 mt-6 text-lg space-y-2">
                                    {slide.slideData.bullets.map((bullet: string, i: number) => <li key={i}>{bullet}</li>)}
                                </ul>
                            )}
                             {slide.slideData.content && <p className="mt-4 text-lg">{slide.slideData.content}</p>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PresentationPreview;