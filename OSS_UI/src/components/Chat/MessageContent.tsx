// src/components/Chat/MessageContent.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAgentChat } from '@/lib/hooks/useAgentChat';

interface MessageContentProps {
  content: string;
  // unique message ID if needed
}

export const MessageContent = ({ content }: MessageContentProps) => {
  const [displayText, setDisplayText] = useState(content);
  const [loadingSection, setLoadingSection] = useState<string | null>(null);
  const { datasetChecking } = useAgentChat(); // obtain global flag (ensure hook is at top of component tree)

  useEffect(() => {
    // Strip dataset JSON triggers from final displayText
    let text = content;
    text = text.replace(/\{"agent_dataset_check".*?\}/, '').trim();
    text = text.replace(/\{"agent_dataset_status".*?\}/, '').trim();
    setDisplayText(text);
  }, [content]);

  return (
    <div className="message-content space-y-2">
      {/* Show loader if datasetChecking is true */}
      {datasetChecking && (
        <div className="flex items-center gap-2 p-2 bg-blue-50 rounded">
          <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
          <span className="text-sm text-blue-700">Checking uploaded files...</span>
        </div>
      )}
      {/* The actual message text */}
      <div className="whitespace-pre-wrap text-text-primary">
        {displayText}
      </div>
    </div>
  );
};
