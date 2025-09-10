'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { useAgentChat, AgentMessage } from '@/lib/hooks/useAgentChat';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { Send, Paperclip, Mic, Copy, RefreshCw, Globe } from 'lucide-react';

function MessageBubble({ message, onCopy, onRegenerate }: { 
  message: AgentMessage; 
  onCopy: (text: string) => void;
  onRegenerate?: () => void;
}) {
  const isUser = message.role === 'user';
  const [showActions, setShowActions] = useState(false);
  
  return (
    <div className={cn('flex w-full mb-6 group', isUser ? 'justify-end' : 'justify-start')}>
      <div className="flex flex-col max-w-[85%]">
        <div
          className={cn('message-bubble', isUser ? 'user' : 'ai')}
          onMouseEnter={() => setShowActions(true)}
          onMouseLeave={() => setShowActions(false)}
        >
          {message.content && (
            <div className="prose prose-sm max-w-none break-words whitespace-pre-wrap">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
          
          {showActions && (
            <div className={cn(
              'absolute top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity',
              isUser ? 'right-2' : 'left-2'
            )}>
              <button
                onClick={() => onCopy(message.content)}
                className="p-1.5 rounded-md bg-black/20 hover:bg-black/30 transition-colors cursor-pointer"
                title="Copy message"
              >
                <Copy size={12} />
              </button>
              {!isUser && onRegenerate && (
                <button
                  onClick={onRegenerate}
                  className="p-1.5 rounded-md bg-black/20 hover:bg-black/30 transition-colors cursor-pointer"
                  title="Regenerate response"
                >
                  <RefreshCw size={12} />
                </button>
              )}
            </div>
          )}
        </div>
        
        <div className={cn('text-xs text-[var(--text-secondary)] mt-1 px-2', isUser ? 'text-right' : 'text-left')}>
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}

function EnhancedChatInput({ onSend, isLoading }: { onSend: (message: string) => void; isLoading: boolean }) {
  const [input, setInput] = useState('');
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (input.trim() && !isLoading) {
      onSend(input.trim());
      setInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log('File selected:', file.name);
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  return (
    <div className="p-4 border-t border-[var(--border-primary)]">
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setWebSearchEnabled(!webSearchEnabled)}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all cursor-pointer",
            webSearchEnabled 
              ? "bg-[var(--cyan-accent)] text-black" 
              : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
          )}
        >
          <Globe size={14} />
          Web Search
        </button>
      </div>

      <div className="relative">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          accept=".pdf,.txt,.csv,.json,.md"
        />
        
        <div className="chat-input-container-new">
          <button
            onClick={handleFileUpload}
            className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            title="Attach file"
            type="button"
          >
            <Paperclip size={18} />
          </button>
          
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask anything..."
            className="chat-textarea-new"
            rows={1}
            disabled={isLoading}
          />
          
          <div className="text-xs text-[var(--text-secondary)] self-end mb-1">
            {input.length} / 2000
          </div>
          
          <div className="flex gap-2">
            {input.length === 0 ? (
              <button
                onClick={() => setIsRecording(!isRecording)}
                className={cn(
                  "p-2 rounded-lg transition-all duration-200 cursor-pointer",
                  isRecording 
                    ? "bg-red-500 text-white animate-pulse" 
                    : "hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
                title="Voice input"
                type="button"
              >
                <Mic size={18} />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className={cn(
                  "p-2 rounded-lg transition-all duration-200",
                  isLoading || !input.trim()
                    ? "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] cursor-not-allowed"
                    : "bg-[var(--cyan-accent)] text-black hover:opacity-80 cursor-pointer"
                )}
                title="Send message"
                type="button"
              >
                <Send size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start mb-6">
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-2xl px-5 py-4 max-w-[200px]">
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-[var(--cyan-accent)] rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-[var(--cyan-accent)] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-[var(--cyan-accent)] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
          <span className="text-[var(--text-secondary)] text-sm select-none">AI is thinking...</span>
        </div>
      </div>
    </div>
  );
}

function ChatPane({ chatId, initialHistory }: { chatId: string; initialHistory: AgentMessage[] }) {
  const { messages, isLoading, sendMessage } = useAgentChat(chatId, initialHistory);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const handleRegenerate = () => {
    console.log('Regenerate last response');
  };

  return (
    <>
      <section className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[var(--bg-primary)]">
        {!isLoading && messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <div className="text-6xl mb-4">
                <div className="w-16 h-16 mx-auto text-[var(--cyan-accent)] flex items-center justify-center">
                  ✨
                </div>
              </div>
              <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2 premium-white">Ready to assist!</h3>
              <p className="text-[var(--text-secondary)]">Ask me anything and I'll help you analyze, code, or research.</p>
            </div>
          </div>
        )}
        
        {messages.map((message) => (
          <MessageBubble 
            key={message.id} 
            message={message} 
            onCopy={handleCopy}
            onRegenerate={message.role === 'assistant' ? handleRegenerate : undefined}
          />
        ))}
        
        {isLoading && messages[messages.length - 1]?.role === 'user' && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </section>

      <EnhancedChatInput onSend={sendMessage} isLoading={isLoading} />
    </>
  );
}

export function AIAssistantPanel() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const [chatId, setChatId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('activeChatId') || 'default';
    }
    return 'default';
  });

  const [initialHistory, setInitialHistory] = useState<AgentMessage[] | null>(null);
  const [bootLoading, setBootLoading] = useState(false);

  // Load notebook when conversation loads
  const loadNotebookForConversation = async (chatId: string) => {
    try {
      const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';
      const notebookRes = await fetch(`${API_BASE}/api/conversation/${encodeURIComponent(chatId)}/notebook`);
      
      if (notebookRes.ok) {
        const notebookData = await notebookRes.json();
        
        // Store notebook data for the notebook component to pick up
        localStorage.setItem(`notebook_${chatId}`, JSON.stringify(notebookData));
        localStorage.setItem('activeNotebookChatId', chatId);
        
        // Broadcast notebook loaded event
        if ('BroadcastChannel' in window) {
          const bc = new BroadcastChannel('osslab-notebook');
          bc.postMessage({
            type: 'notebook_loaded',
            chatId: chatId,
            notebookData: notebookData
          });
          bc.close();
        }
      }
    } catch (error) {
      console.log('No notebook available for this conversation');
    }
  };

  useEffect(() => {
    const qp = searchParams?.get('chatId');
    if (!qp) return;
    const id = qp || 'default';
    setChatId(id);
    try {
      localStorage.setItem('activeChatId', id);
      localStorage.setItem('activeChatId:updatedAt', String(Date.now()));
    } catch {}
    router.replace(pathname);
  }, [searchParams, pathname, router]);

  useEffect(() => {
    if (!('BroadcastChannel' in window)) return;
    const bc = new BroadcastChannel('osslab-chat');
    bc.onmessage = (evt) => {
      if (evt?.data?.type === 'switch' && evt.data.chatId) {
        setChatId(String(evt.data.chatId));
        try {
          localStorage.setItem('activeChatId', String(evt.data.chatId));
          localStorage.setItem('activeChatId:updatedAt', String(Date.now()));
        } catch {}
      }
    };
    return () => bc.close();
  }, []);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === 'activeChatId' && e.newValue) setChatId(e.newValue);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Enhanced conversation loading with notebook detection
  useEffect(() => {
    let ignore = false;
    async function load() {
      setBootLoading(true);
      try {
        const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';
        const res = await fetch(`${API_BASE}/api/conversation/${encodeURIComponent(chatId)}`);
        if (!res.ok) throw new Error(`Failed to fetch conversation: ${res.statusText}`);
        const data = await res.json();
        
        const mapped: AgentMessage[] = (data.chat_history ?? []).map((msg: any, idx: number) => ({
          id: msg.id ?? String(idx),
          role: msg.role || 'assistant',
          content: msg.content || '',
        }));
        
        if (!ignore) {
          setInitialHistory(mapped);
          
          // Check if conversation has an associated notebook
          if (data.has_notebook) {
            loadNotebookForConversation(chatId);
          }
        }
      } catch {
        if (!ignore) setInitialHistory([]);
      } finally {
        if (!ignore) setBootLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [chatId]);

  const handleSwitch = () => {
    try {
      localStorage.removeItem('activeChatId');
      localStorage.setItem('activeChatId:updatedAt', String(Date.now()));
    } catch {}
    setChatId('default');
    setInitialHistory([]);
    router.push('/library');
  };

  const handleReset = () => {
    try {
      localStorage.setItem('activeChatId', 'default');
      localStorage.setItem('activeChatId:updatedAt', String(Date.now()));
    } catch {}
    setChatId('default');
    setInitialHistory([]);
  };

  return (
    <aside className="w-[400px] flex-shrink-0 bg-[var(--bg-primary)] border-l border-[var(--border-primary)] flex flex-col h-screen">
      <header className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[var(--cyan-accent)] text-xl">✨</span>
            <h2 className="text-[var(--text-primary)] text-xl font-bold select-none premium-white">AI Assistant</h2>
          </div>
          <div
            className="w-3 h-3 rounded-full bg-[var(--cyan-accent)] animate-pulse"
            title="Online"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleSwitch}
            className="px-3 py-1.5 text-sm rounded-md border border-[var(--border-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all cursor-pointer"
            title="Switch conversation"
          >
            Switch
          </button>
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-sm rounded-md border border-[var(--border-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all cursor-pointer"
            title="Start new conversation"
          >
            Reset
          </button>
        </div>
      </header>

      {bootLoading || initialHistory === null ? (
        <section className="flex-1 p-4 flex items-center justify-center bg-[var(--bg-primary)]">
          <div className="flex items-center space-x-3 text-[var(--text-secondary)]">
            <div className="w-5 h-5 border-2 border-[var(--cyan-accent)] border-t-transparent rounded-full animate-spin" />
            <span>Loading conversation...</span>
          </div>
        </section>
      ) : (
        <ChatPane key={chatId} chatId={chatId} initialHistory={initialHistory} />
      )}
    </aside>
  );
}

export default AIAssistantPanel;
