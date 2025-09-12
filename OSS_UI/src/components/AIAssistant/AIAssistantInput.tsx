'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { useAgentChat, AgentMessage } from '@/lib/hooks/useAgentChat';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { Copy, RefreshCw } from 'lucide-react';

// MessageBubble Component
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
          className={cn(
            'message-bubble relative',
            isUser ? 'user' : 'ai'
          )}
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

// TypingIndicator Component
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

// ChatPane Component
function ChatPane({ chatId, initialHistory }: { 
  chatId: string; 
  initialHistory: AgentMessage[];
}) {
  const { messages, isLoading } = useAgentChat(chatId, initialHistory);
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
  );
}

// Empty State Component
function EmptyState() {
  return (
    <section className="flex-1 p-4 flex items-center justify-center bg-[var(--bg-primary)]">
      <div className="flex items-center space-x-3 text-[var(--text-secondary)]">
        <div className="w-5 h-5 border-2 border-[var(--cyan-accent)] border-t-transparent rounded-full animate-spin" />
        <span>Loading conversation...</span>
      </div>
    </section>
  );
}

// Main AIAssistantPanel Component
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

  // Handle URL params
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

  // BroadcastChannel handling
  useEffect(() => {
    if (!('BroadcastChannel' in window)) return;
    const bc = new BroadcastChannel('osslab-chat');
    bc.onmessage = (evt) => {
      if (evt?.data?.type === 'switch' && evt.data.chatId) {
        const newChatId = String(evt.data.chatId);
        setChatId(newChatId);
        try {
          localStorage.setItem('activeChatId', newChatId);
          localStorage.setItem('activeChatId:updatedAt', String(Date.now()));
        } catch {}
      }
    };
    return () => bc.close();
  }, []);

  // Storage event handling
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === 'activeChatId' && e.newValue) {
        setChatId(e.newValue);
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Load conversation data
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
        if (!ignore) setInitialHistory(mapped);
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

  // Switch handler - goes to library
  const handleSwitch = () => {
    try {
      localStorage.removeItem('activeChatId');
      localStorage.setItem('activeChatId:updatedAt', String(Date.now()));
    } catch {}
    setChatId('default');
    setInitialHistory([]);
    router.push('/library');
  };

  // ✅ FIXED: Reset handler - actually executes the code
  const handleReset = () => {
    try {
      localStorage.removeItem('activeChatId');
      localStorage.setItem('activeChatId', 'default');
      localStorage.setItem('activeChatId:updatedAt', String(Date.now()));
      localStorage.removeItem('osslab_file_contexts'); // Clear file contexts too
    } catch {}
    
    setChatId('default');
    setInitialHistory([]);
    
    // Navigate to dashboard (main page)
    router.push('/');
    
    console.log('🔄 Reset clicked - navigated to dashboard');
  };

  return (
    <aside className="w-[400px] flex-shrink-0 bg-[var(--bg-primary)] border-l border-[var(--border-primary)] flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[var(--cyan-accent)] text-xl">✨</span>
            <h2 className="text-[var(--text-primary)] text-xl font-bold select-none premium-white">AI Assistant</h2>
          </div>
          <div className="w-3 h-3 rounded-full bg-[var(--cyan-accent)] animate-pulse" title="Online" />
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleSwitch}
            className="px-3 py-1.5 text-sm rounded-md border border-[var(--border-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all cursor-pointer"
            title="Switch conversation - go to library"
          >
            Switch
          </button>
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-sm rounded-md border border-[var(--border-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all cursor-pointer"
            title="Reset conversation - go to dashboard"
          >
            Reset
          </button>
        </div>
      </header>

      {/* Chat Area */}
      {bootLoading || initialHistory === null ? (
        <EmptyState />
      ) : (
        <ChatPane chatId={chatId} initialHistory={initialHistory} />
      )}

      {/* Input Area */}
      <div className="border-t border-[var(--border-primary)]">
        {/* Input component goes here */}
      </div>
    </aside>
  );
}

export default AIAssistantPanel;
