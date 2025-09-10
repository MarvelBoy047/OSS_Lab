'use client';

import DeleteChat from '@/components/DeleteChat';
import { BookOpenText } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { parseISO, formatDistanceToNow } from 'date-fns';

export interface Chat {
  id: string;
  title: string;
  created_at: string;
  focusMode?: string;
  has_notebook?: boolean;
  notebook_count?: number;
  dataset_count?: number;
}

// Hardcoded purple glow style for active chat
const purpleGlowStyle = {
  boxShadow: '0 0 20px 8px rgba(139, 92, 246, 0.9), 0 0 30px 12px rgba(139, 92, 246, 0.6), 0 0 40px 16px rgba(139, 92, 246, 0.3)',
  border: '2px solid rgba(139, 92, 246, 0.9)',
  backgroundColor: 'rgba(139, 92, 246, 0.05)',
  transform: 'scale(1.02)',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  zIndex: 10,
  position: 'relative' as const,
};

const safeFormatTimeDifference = (dateStr?: string) => {
  if (!dateStr) return 'Unknown time';
  try {
    const parsedDate = parseISO(dateStr);
    if (isNaN(parsedDate.getTime())) return 'Unknown time';
    return formatDistanceToNow(parsedDate, { addSuffix: true });
  } catch {
    return 'Unknown time';
  }
};

const Page = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  // Get active chat ID from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedChatId = localStorage.getItem('activeChatId');
      setActiveChatId(storedChatId);
    }
  }, []);

  useEffect(() => {
    const fetchChats = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/conversations`);
        if (!res.ok) throw new Error('Failed to fetch chats');
        const data = await res.json();
        setChats(data.conversations || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchChats();
  }, []);

  const loadConversation = (chatId: string) => {
    try {
      localStorage.setItem('activeChatId', chatId);
      localStorage.setItem('activeChatId:updatedAt', String(Date.now()));
      setActiveChatId(chatId);
      
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel('osslab-chat');
        bc.postMessage({
          type: 'switch',
          chatId: chatId
        });
        bc.close();
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  };

  return (
    <main className="flex-1 flex flex-col p-6 overflow-hidden">
      <div className="flex-shrink-0">
        <div className="flex items-center space-x-2">
          <BookOpenText size={32} className="text-[var(--text-primary)]" />
          <h1 className="text-3xl font-bold premium-white">Library</h1>
        </div>
        <hr className="border-t border-[var(--border-primary)] my-4 w-full" />
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center gap-3 text-[var(--text-secondary)]">
              <div className="w-6 h-6 border-2 border-[var(--cyan-accent)] border-t-transparent rounded-full animate-spin"></div>
              <span>Loading conversations...</span>
            </div>
          </div>
        ) : chats.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <span className="material-symbols-outlined text-6xl text-[var(--text-secondary)] mb-4 block">library_books</span>
              <p className="text-[var(--text-secondary)] text-lg">No conversations found.</p>
              <p className="text-[var(--text-muted)] text-sm mt-2">Start a conversation with the AI Assistant to build your library.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {chats.map((chat) => (
              <div
                key={chat.id}
                className="activity-card"
                style={chat.id === activeChatId ? purpleGlowStyle : {}}
              >
                <div className="flex items-center justify-between">
                  <Link 
                    href={`/c/${chat.id}`} 
                    className="flex-1 overflow-hidden"
                    onClick={() => loadConversation(chat.id)}
                  >
                    <div className="flex items-center gap-4">
                      <span className="material-symbols-outlined text-[var(--text-secondary)]">
                        description
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="premium-white font-medium truncate">{chat.title}</p>
                          {chat.has_notebook && (
                            <span 
                              className="material-symbols-outlined text-xs text-[var(--cyan-accent)]" 
                              title="Has analysis notebook"
                            >
                              description
                            </span>
                          )}
                          {chat.id === activeChatId && (
                            <span 
                              className="px-2 py-1 text-xs rounded-full font-bold"
                              style={{
                                backgroundColor: 'rgba(139, 92, 246, 0.2)',
                                color: 'rgba(139, 92, 246, 1)',
                                border: '1px solid rgba(139, 92, 246, 0.5)'
                              }}
                            >
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
                          <span>Updated {safeFormatTimeDifference(chat.created_at)}</span>
                          {(chat.notebook_count || 0) > 0 && (
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">science</span>
                              {chat.notebook_count} experiment{(chat.notebook_count || 0) > 1 ? 's' : ''}
                            </span>
                          )}
                          {(chat.dataset_count || 0) > 0 && (
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">hub</span>
                              {chat.dataset_count} dataset{(chat.dataset_count || 0) > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>

                  <div className="flex items-center gap-2 pl-4">
                    {chat.has_notebook && (
                      <Link
                        href={`/notebook?chatId=${chat.id}`}
                        className="text-xs px-2 py-1 rounded border border-[var(--border-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                        onClick={() => loadConversation(chat.id)}
                      >
                        Notebook
                      </Link>
                    )}
                    <DeleteChat chatId={chat.id} chats={chats} setChats={setChats} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
};

export default Page;
