'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatTimeDifference } from '@/lib/utils';
import { cn } from '@/lib/utils';
import NotebookDisplay from '@/components/NotebookDisplay';

interface Chat { 
  id: string; 
  title: string; 
  created_at: string;
  has_notebook?: boolean;
  notebook_count?: number;
  dataset_count?: number;
}

// Hardcoded purple glow style
const purpleGlowStyle = {
  boxShadow: '0 0 20px 8px rgba(139, 92, 246, 0.9), 0 0 30px 12px rgba(139, 92, 246, 0.6), 0 0 40px 16px rgba(139, 92, 246, 0.3)',
  border: '2px solid rgba(139, 92, 246, 0.9)',
  backgroundColor: 'rgba(139, 92, 246, 0.05)',
  transform: 'scale(1.02)',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  zIndex: 10,
  position: 'relative' as const,
};

const EmptyState = ({ title, message, icon }: { title: string; message: string; icon: string }) => (
  <div className="flex flex-col items-center justify-center h-full text-center text-[var(--text-secondary)] p-10">
    <span className="material-symbols-outlined text-6xl mb-4 text-[var(--text-secondary)]">{icon}</span>
    <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2 premium-white">{title}</h3>
    <p className="text-[var(--text-secondary)]">{message}</p>
  </div>
);

const HomePage = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [totalExperiments, setTotalExperiments] = useState(0);
  const [totalDatasets, setTotalDatasets] = useState(0);

  // Get active chat ID from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedChatId = localStorage.getItem('activeChatId');
      setActiveChatId(storedChatId);
    }
  }, []);

  useEffect(() => {
    const fetchChats = async () => {
      setIsLoading(true);
      try {
        const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';
        const res = await fetch(`${API_BASE}/api/conversations`);
        if (!res.ok) throw new Error('Failed to fetch conversations');
        const data = await res.json();
        
        setChats(data.conversations || []);
        setTotalExperiments(data.total_experiments || 0);
        setTotalDatasets(data.total_datasets || 0);
      } catch (error) { 
        console.error(error); 
      } finally { 
        setIsLoading(false); 
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

  const renderContent = () => {
    switch (activeTab) {
      case 'notebook': 
        return <NotebookDisplay />;
      case 'presentation': 
        return (
          <EmptyState 
            title="No Presentations Available" 
            message="Complete a notebook to generate a presentation." 
            icon="slideshow" 
          />
        );
      default: 
        return (
          <div className="flex-1 space-y-8 pb-6">
            <div className="insight-card">
              <h2 className="section-title">Key Insights</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-6">
                <div className="bg-[var(--bg-tertiary)] p-4 rounded-lg flex items-center transition-colors">
                  <span 
                    className="material-symbols-outlined text-3xl text-[var(--accent)]" 
                    style={{ filter: 'drop-shadow(0 0 5px rgba(34, 211, 238, 0.3))' }}
                  >
                    model_training
                  </span>
                  <div className="ml-4">
                    <p className="text-[var(--text-secondary)] text-sm">Models Trained</p>
                    <p className="premium-white font-bold text-2xl">0</p>
                  </div>
                </div>
                <div className="bg-[var(--bg-tertiary)] p-4 rounded-lg flex items-center transition-colors">
                  <span 
                    className="material-symbols-outlined text-3xl text-[var(--accent)]" 
                    style={{ filter: 'drop-shadow(0 0 5px rgba(34, 211, 238, 0.3))' }}
                  >
                    bar_chart
                  </span>
                  <div className="ml-4">
                    <p className="text-[var(--text-secondary)] text-sm">Active Projects</p>
                    <p className="premium-white font-bold text-2xl">{isLoading ? '...' : chats.length}</p>
                  </div>
                </div>
                <div className="bg-[var(--bg-tertiary)] p-4 rounded-lg flex items-center transition-colors">
                  <span 
                    className="material-symbols-outlined text-3xl text-[var(--accent)]" 
                    style={{ filter: 'drop-shadow(0 0 5px rgba(34, 211, 238, 0.3))' }}
                  >
                    science
                  </span>
                  <div className="ml-4">
                    <p className="text-[var(--text-secondary)] text-sm">Experiments</p>
                    <p className="premium-white font-bold text-2xl">{isLoading ? '...' : totalExperiments}</p>
                  </div>
                </div>
                <div className="bg-[var(--bg-tertiary)] p-4 rounded-lg flex items-center transition-colors">
                  <span 
                    className="material-symbols-outlined text-3xl text-[var(--accent)]" 
                    style={{ filter: 'drop-shadow(0 0 5px rgba(34, 211, 238, 0.3))' }}
                  >
                    hub
                  </span>
                  <div className="ml-4">
                    <p className="text-[var(--text-secondary)] text-sm">Datasets</p>
                    <p className="premium-white font-bold text-2xl">{isLoading ? '...' : totalDatasets}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="insight-card">
              <h2 className="section-title">Recent Activity</h2>
              <div className="space-y-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                      <div className="w-5 h-5 border-2 border-[var(--cyan-accent)] border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading conversations...</span>
                    </div>
                  </div>
                ) : chats.length > 0 ? (
                  chats.slice(0, 5).map(chat => (
                    <div 
                      key={chat.id} 
                      className="activity-card"
                      style={chat.id === activeChatId ? purpleGlowStyle : {}}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="material-symbols-outlined text-[var(--text-secondary)]">description</span>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="premium-white font-medium">{chat.title}</p>
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
                            <p className="text-xs text-[var(--text-secondary)]">
                              Updated {formatTimeDifference(new Date(), new Date(chat.created_at))} ago
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {chat.has_notebook && (
                            <button
                              onClick={() => {
                                loadConversation(chat.id);
                                setActiveTab('notebook');
                              }}
                              className="text-sm rounded-md px-3 py-1.5 border border-[var(--border-primary)] hover:border-[var(--input-focus)] transition-colors text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                              title="View notebook"
                            >
                              Notebook
                            </button>
                          )}
                          <button
                            onClick={() => loadConversation(chat.id)}
                            className="text-sm rounded-md px-3 py-1.5 border border-[var(--border-primary)] hover:border-[var(--input-focus)] transition-colors text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                          >
                            View
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <span className="material-symbols-outlined text-4xl text-[var(--text-secondary)] mb-3">chat</span>
                    <p className="text-[var(--text-secondary)]">No conversations found.</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">Start a conversation with the AI Assistant to get started.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <main className="flex-1 flex flex-col p-6 overflow-hidden bg-[var(--bg-primary)]">
      <header className="mb-6 flex-shrink-0">
        <nav className="relative">
          <div className="main-nav-container" id="main-nav">
            <button 
              onClick={() => setActiveTab('dashboard')} 
              className={cn("main-nav-link", activeTab === 'dashboard' && 'active')}
            >
              Dashboard
            </button>
            <button 
              onClick={() => setActiveTab('notebook')} 
              className={cn("main-nav-link", activeTab === 'notebook' && 'active')}
            >
              Notebook
            </button>
            <button 
              onClick={() => setActiveTab('presentation')} 
              className={cn("main-nav-link", activeTab === 'presentation' && 'active')}
            >
              Presentation
            </button>
          </div>
        </nav>
      </header>
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {renderContent()}
      </div>
    </main>
  );
};

export default HomePage;
