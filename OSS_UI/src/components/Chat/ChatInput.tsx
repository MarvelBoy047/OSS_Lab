'use client';

import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';

interface ChatInputProps {
  onSend: (text: string) => Promise<void> | void;
  isLoading?: boolean;
}

export default function ChatInput({ onSend, isLoading = false }: ChatInputProps) {
  const [text, setText] = useState('');
  const [webEnabled, setWebEnabled] = useState(false);
  const [chatId, setChatId] = useState('default');
  const attachRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setChatId(localStorage.getItem('activeChatId') || 'default');
      setWebEnabled(localStorage.getItem('webEnabled') === 'true');
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('webEnabled', String(webEnabled));
    }
  }, [webEnabled]);

  async function handleAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // Add your allowed file types here:
    const allowed = ['pdf', 'docx', 'txt'];
    const invalid = files.find((f) => !allowed.includes(f.name.split('.').pop()?.toLowerCase() || ''));
    if (invalid) {
      toast.error('Only PDF, DOCX, TXT files allowed via paperclip');
      if (attachRef.current) attachRef.current.value = '';
      return;
    }

    try {
      const fd = new FormData();
      fd.append('chatId', chatId);
      files.forEach((f) => fd.append('files', f));

      const res = await fetch('/api/attachments', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Upload failed');
      toast.success(`Attached ${data.files?.length || 0} document(s)`);
    } catch (err: any) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      if (attachRef.current) attachRef.current.value = '';
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || isLoading) return;
    await onSend(text.trim());
    setText('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 border-t border-[#2C2C2C] bg-bg-secondary relative flex items-center gap-2">
      {/* Web search toggle */}
      <button
        type="button"
        onClick={() => setWebEnabled((v) => !v)}
        className={`p-2 rounded-lg transition-all duration-200 ${
          webEnabled ? 'bg-blue-500 text-white' : 'text-text-secondary hover:bg-bg-primary hover:text-text-primary'
        }`}
        title={webEnabled ? 'Web search: ON' : 'Web search: OFF'}
      >
        🌐
      </button>

      {/* Attach reference docs */}
      <button
        type="button"
        onClick={() => attachRef.current?.click()}
        className="p-2 text-text-secondary hover:bg-bg-primary hover:text-text-primary rounded-lg"
        title="Attach reference documents"
      >
        📎
      </button>
      <input ref={attachRef} type="file" accept=".pdf,.docx,.txt" multiple className="hidden" onChange={handleAttach} />

      {/* Text input */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
        placeholder="Ask anything..."
        rows={1}
        className="flex-1 bg-transparent border-0 outline-none resize-none text-text-primary placeholder-text-secondary text-sm py-2 px-2 max-h-32 overflow-y-auto"
        style={{ minHeight: '40px', scrollbarWidth: 'thin', scrollbarColor: '#4a5568 transparent' }}
      />

      {/* Send button */}
      <button
        type="submit"
        disabled={!text.trim() || isLoading}
        className="p-2 rounded-lg bg-cyan-500 text-black disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        title="Send message"
      >
        ➤
      </button>

      {/* Character count */}
      <div className="absolute bottom-2 right-4 text-xs text-text-secondary">{text.length} / 2000</div>
    </form>
  );
}
