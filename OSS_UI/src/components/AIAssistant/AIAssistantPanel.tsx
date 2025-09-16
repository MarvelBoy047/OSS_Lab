'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { useAgentChat, AgentMessage } from '@/lib/hooks/useAgentChat';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { Send, Mic, Copy, RefreshCw, Globe, Paperclip, X, Trash2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import React from 'react';

// Types
interface ChatActions {
  onCopy: (text: string) => Promise<void>;
  onRegenerate?: () => void;
}

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  onFileUpload?: () => void;
  chatId?: string;
}

interface ChatHeaderProps {
  onSwitch: () => void;
  onReset: () => void;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  chatId: string;
}

// Constants
const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';
const MAX_INPUT_LENGTH = 2000;

// File Upload Card Component
const FileUploadCard = ({ file, onRemove }: { file: UploadedFile; onRemove: (id: string) => void }) => {
  const getFileIcon = (type: string) => {
    const ext = type.toLowerCase();
    if (ext.includes('pdf')) return { icon: '📄', color: 'bg-red-500', label: 'PDF' };
    if (ext.includes('doc')) return { icon: '📝', color: 'bg-blue-500', label: 'DOC' };
    if (ext.includes('txt')) return { icon: '📄', color: 'bg-gray-500', label: 'TXT' };
    if (ext.includes('json')) return { icon: '🔧', color: 'bg-yellow-500', label: 'JSON' };
    return { icon: '📄', color: 'bg-gray-500', label: 'FILE' };
  };

  const fileInfo = getFileIcon(file.type);
  const sizeInKB = Math.round(file.size / 1024);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3">
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold", fileInfo.color)}>
          {fileInfo.label}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {file.name}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {sizeInKB}KB
          </div>
          
          {file.status === 'uploading' && (
            <div className="mt-2">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                <div 
                  className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${file.progress}%` }}
                />
              </div>
            </div>
          )}
          
          {file.status === 'completed' && (
            <div className="mt-2">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                <div className="bg-green-500 h-1.5 rounded-full w-full" />
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => onRemove(file.id)}
          className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Remove file"
        >
          {file.status === 'completed' ? (
            <Trash2 size={16} className="text-gray-400 hover:text-red-500" />
          ) : (
            <X size={16} className="text-gray-400 hover:text-red-500" />
          )}
        </button>
      </div>
    </div>
  );
};


// Enhanced Chat Manager Hook
function useChatManager() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  
  const [chatId, setChatId] = useState('');
  const [initialHistory, setInitialHistory] = useState<AgentMessage[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInputEnabled, setIsInputEnabled] = useState(true);

  // A ref to track the previous state of the chatId
  const prevChatIdRef = useRef(chatId);

  // A stable reset function we can call from anywhere
  const resetChat = useCallback(() => {
    console.log('🔄 Resetting chat state');
    setChatId('');
    setInitialHistory([]);
    setIsInputEnabled(true);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('activeChatId');
      localStorage.removeItem('activeNotebookId');
      
      const bc = new BroadcastChannel('osslab-chat');
      bc.postMessage({ type: 'reset' });
      bc.close();
    }
  }, []);

  // Load chatId from localStorage on initial mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedChatId = localStorage.getItem('activeChatId') || '';
      setChatId(storedChatId);
    }
  }, []);

  // ✅ MODIFIED: This effect now broadcasts the new chatId with the event
  useEffect(() => {
    // This detects a transition from "no chat" to "a new chat"
    if (prevChatIdRef.current === '' && chatId) {
      console.log(`🎉 New chat created (${chatId}). Broadcasting "chat_list_updated".`);
      
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel('osslab-chat');
        // We now send the new chatId in the message payload
        channel.postMessage({ type: 'chat_list_updated', chatId: chatId });
        channel.close();
      }
    }
    // Update the ref for the next render
    prevChatIdRef.current = chatId;
  }, [chatId]);

  // Load conversation data when chatId changes
  useEffect(() => {
    if (!chatId) {
      setInitialHistory([]);
      setIsLoading(false);
      setIsInputEnabled(true);
      return;
    }

    let ignore = false;
    setIsLoading(true);

    const loadConversation = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/conversation/${encodeURIComponent(chatId)}`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const messages: AgentMessage[] = (data.chat_history ?? []).map((msg: any, idx: number) => ({
          id: msg.id ?? `msg-${idx}`,
          role: msg.role || 'assistant',
          content: msg.content || '',
          timestamp: msg.timestamp || new Date().toISOString()
        }));

        if (!ignore) {
          setInitialHistory(messages);
          if (data.has_notebook) await loadNotebookData(chatId);
        }
      } catch (error: any) {
        // ✅ THIS FIXES THE 404 ERROR
        console.error('❌ Failed to load conversation:', error);
        if (!ignore) {
          if (error.message && error.message.includes('404')) {
            toast.error('Active chat not found. It may have been deleted.');
            resetChat(); // Gracefully reset the chat panel to the default state
          } else {
            toast.error('Failed to load conversation');
            setInitialHistory([]);
          }
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
          setIsInputEnabled(true);
        }
      }
    };

    loadConversation();
    return () => { ignore = true; };
  }, [chatId, resetChat]);

  // Handle URL-based chat switching  
  useEffect(() => {
    const urlChatId = searchParams?.get('chatId');
    if (urlChatId && urlChatId !== chatId) {
      setChatId(urlChatId);
      if (typeof window !== 'undefined') {
        localStorage.setItem('activeChatId', urlChatId);
      }
    }
  }, [searchParams, chatId]);

  // Handle cross-tab communication
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    
    const bc = new BroadcastChannel('osslab-chat');
    bc.onmessage = (evt) => {
      if (evt?.data?.type === 'switch' && evt.data.chatId !== chatId) {
        setChatId(evt.data.chatId);
        localStorage.setItem('activeChatId', evt.data.chatId);
      } else if (evt?.data?.type === 'reset') {
        resetChat();
      }
    };
    return () => bc.close();
  }, [chatId, resetChat]);

  return {
    chatId,
    setChatId,
    initialHistory,
    setInitialHistory,
    isLoading,
    isInputEnabled,
    setIsInputEnabled,
    resetChat,
  };
}

// Utility function for notebook loading
async function loadNotebookData(chatId: string) {
  try {
    const response = await fetch(`${API_BASE}/api/conversation/${encodeURIComponent(chatId)}/notebook`);
    if (response.ok) {
      const notebookData = await response.json();
      if (typeof window !== 'undefined') {
        localStorage.setItem(`notebook_${chatId}`, JSON.stringify(notebookData));
        localStorage.setItem('activeNotebookChatId', chatId);
      }
      
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('osslab-notebook');
        bc.postMessage({
          type: 'notebook_loaded',
          chatId,
          notebookData
        });
        bc.close();
      }
    }
  } catch (error) {
    console.log('No notebook available for this conversation:', error);
  }
}

// Message Bubble Component
const MessageBubble = ({ message, onCopy, onRegenerate }: {
  message: AgentMessage;
} & ChatActions) => {
  const isUser = message.role === 'user';
  const [showActions, setShowActions] = useState(false);

  const handleCopy = useCallback(() => {
    onCopy(message.content);
  }, [onCopy, message.content]);

  const timestamp = useMemo(() => {
    if (message.timestamp) {
      return new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [message.timestamp]);

  return (
    <div
      className={cn(
        'message-bubble group relative',
        isUser ? 'user' : 'ai'
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {message.content && (
        <div className="prose prose-sm max-w-none">
          <ReactMarkdown>
            {message.content}
          </ReactMarkdown>
        </div>
      )}
      
      {showActions && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleCopy}
            className="p-1 text-xs bg-black/10 hover:bg-black/20 rounded"
            title="Copy"
          >
            <Copy size={12} />
          </button>
          {!isUser && onRegenerate && (
            <button
              onClick={onRegenerate}
              className="p-1 text-xs bg-black/10 hover:bg-black/20 rounded"
              title="Regenerate"
            >
              <RefreshCw size={12} />
            </button>
          )}
        </div>
      )}
      
      <div className="text-xs text-gray-500 mt-2">
        {timestamp}
      </div>
    </div>
  );
};

// Enhanced Chat Input Component with Document Upload
const EnhancedChatInput = ({ onSend, isLoading, disabled = false, onFileUpload, chatId }: ChatInputProps) => {
  const [input, setInput] = useState('');
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const canSend = useMemo(() => {
    return input.trim().length > 0 && !isLoading && !disabled;
  }, [input, isLoading, disabled]);

  const isOverLimit = input.length > MAX_INPUT_LENGTH;

  // 🚨 FIX: Enhanced send handler to include file context
  const handleSend = useCallback(() => {
    if (canSend && !isOverLimit) {
      let messageToSend = input.trim();
      
      // 🚨 KEY FIX: Add file context to message if files are uploaded
      const completedFiles = uploadedFiles.filter(f => f.status === 'completed');
      if (completedFiles.length > 0) {
        const fileContext = completedFiles.map(f => f.name).join(', ');
        messageToSend = `[CONTEXT: Reference documents available: ${fileContext}]\n\n${messageToSend}`;
        console.log('📎 Adding file context to message:', fileContext);
      }
      
      onSend(messageToSend);
      setInput('');
      // Clear uploaded files after sending message
      setUploadedFiles([]);
    }
  }, [canSend, isOverLimit, onSend, input, uploadedFiles]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleFileUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log('File selected:', file.name);
      toast.info(`File selected: ${file.name}`);
      
      if (onFileUpload) {
        onFileUpload();
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onFileUpload]);

  // Document upload handler
  const handleDocumentUpload = useCallback(() => {
    documentInputRef.current?.click();
  }, []);

  // 🚨 FIX: Enhanced document change handler with proper backend integration
  const handleDocumentChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    const file = files?.[0];
    
    if (!file) return;
    
    if (!chatId) {
      toast.error('No active chat session - start a conversation first');
      return;
    }

    // Validate file type
    const allowedTypes = ['.txt', '.md', '.pdf', '.docx', '.json'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!allowedTypes.includes(fileExtension)) {
      toast.error(`Unsupported file type: ${fileExtension}`);
      return;
    }

    // Validate file size (50MB max)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('File too large. Maximum size is 50MB');
      return;
    }

    // Create upload file object
    const uploadFile: UploadedFile = {
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      type: file.type || fileExtension,
      progress: 0,
      status: 'uploading',
      chatId: chatId
    };

    // Add to uploaded files list
    setUploadedFiles(prev => [...prev, uploadFile]);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setUploadedFiles(prev => 
        prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, progress: Math.min(f.progress + 20, 90) }
            : f
        )
      );
    }, 200);

    try {
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('file', file);

      console.log('📎 Uploading to backend with chat_id:', chatId);
      const response = await fetch(`${API_BASE}/api/upload/reference_document`, {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Upload successful:', result);
        
        // Mark as completed
        setUploadedFiles(prev => 
          prev.map(f => 
            f.id === uploadFile.id 
              ? { ...f, progress: 100, status: 'completed' }
              : f
          )
        );

        // 🚨 KEY FIX: Ensure backend context is properly set
        // The backend should now have the file associated with this chat_id
        // Add a small delay to ensure backend processing is complete
        setTimeout(() => {
          if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
            const fileChannel = new BroadcastChannel('osslab-files');
            fileChannel.postMessage({
              type: 'files_added',
              files: [{ name: file.name, type: 'reference_document', chatId }],
              chatId: chatId
            });
            fileChannel.close();
          }
          
          if (onFileUpload) {
            onFileUpload();
          }
        }, 500);

        toast.success(`Document uploaded: ${file.name}`, {
          description: 'File is ready for context in this chat'
        });
        
      } else {
        // Mark as error
        setUploadedFiles(prev => 
          prev.map(f => 
            f.id === uploadFile.id 
              ? { ...f, status: 'error' }
              : f
          )
        );
        
        const error = await response.json();
        console.error('❌ Upload failed:', error);
        toast.error('Upload failed: ' + (error.detail || 'Please try again'));
      }
    } catch (error) {
      clearInterval(progressInterval);
      setUploadedFiles(prev => 
        prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, status: 'error' }
            : f
        )
      );
      console.error('❌ Upload error:', error);
      toast.error('Upload failed: Network error');
    } finally {
      if (e.target) {
        e.target.value = '';
      }
    }
  }, [chatId, onFileUpload]);

  // Remove uploaded file
  const handleRemoveFile = useCallback((fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  // Force focus on textarea when enabled
  useEffect(() => {
    if (!disabled && !isLoading && textareaRef.current) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [disabled, isLoading]);

  // 🚨 FIX: Consistent button state to prevent hydration mismatch
  const isDocumentUploadDisabled = disabled || !chatId;
  const docUploadTitle = !chatId ? "Start a conversation to upload documents" : "Upload reference document";

  return (
    <div className="space-y-3">
      {/* File Upload Section */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
            File Uploaded
          </div>
          {uploadedFiles.map(file => (
            <FileUploadCard
              key={file.id}
              file={file}
              onRemove={handleRemoveFile}
            />
          ))}
        </div>
      )}

      {/* Chat Input */}
      <div className="chat-input-container-new">
        <button
          onClick={() => setWebSearchEnabled(!webSearchEnabled)}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all",
            webSearchEnabled
              ? "bg-[var(--cyan-accent)] text-black"
              : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
          )}
          aria-label={webSearchEnabled ? 'Disable web search' : 'Enable web search'}
          disabled={disabled}
        >
          <Globe size={16} />
          Web Search {webSearchEnabled ? 'ON' : 'OFF'}
        </button>

        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={disabled ? "Loading..." : "Ask anything..."}
          className="chat-textarea-new"
          rows={1}
          disabled={disabled || isLoading}
          maxLength={MAX_INPUT_LENGTH}
        />

        <div className="text-xs text-[var(--text-secondary)]">
          {input.length} / {MAX_INPUT_LENGTH}
        </div>

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />

        <input
          ref={documentInputRef}
          type="file"
          className="hidden"
          accept=".txt,.md,.pdf,.docx,.json"
          onChange={handleDocumentChange}
        />

        <div className="flex items-center gap-2">
          {/* Document upload button (paperclip) */}
          <button
            onClick={handleDocumentUpload}
            disabled={isDocumentUploadDisabled}
            className={cn(
              "p-2 rounded-lg transition-all duration-200",
              isDocumentUploadDisabled 
                ? "opacity-50 cursor-not-allowed text-gray-400"
                : "hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
            title={docUploadTitle}
            type="button"
          >
            <Paperclip size={20} />
          </button>

          {input.length === 0 ? (
            <button
              onClick={() => setIsRecording(!isRecording)}
              className={cn(
                "p-2 rounded-lg transition-all duration-200",
                isRecording
                  ? "bg-red-500 text-white animate-pulse"
                  : "hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
              title="Voice input"
              type="button"
              disabled={disabled}
              aria-label="Voice input"
            >
              <Mic size={20} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!canSend || isOverLimit || disabled}
              className={cn(
                "p-2 rounded-lg transition-all duration-200",
                canSend && !isOverLimit && !disabled
                  ? "bg-[var(--cyan-accent)] text-black hover:opacity-80"
                  : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] cursor-not-allowed"
              )}
              title="Send message"
              type="button"
              aria-label="Send message"
            >
              <Send size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// UI State Components
const TypingIndicator = () => (
  <div className="flex items-center gap-1 p-4">
    {[0, 0.1, 0.2].map((delay, i) => (
      <div
        key={i}
        className="w-2 h-2 bg-[var(--text-secondary)] rounded-full animate-bounce"
        style={{ animationDelay: `${delay}s` }}
      />
    ))}
    <span className="ml-2 text-sm text-[var(--text-secondary)]">AI is thinking...</span>
  </div>
);

const EmptyState = () => (
  <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
    <div className="text-4xl mb-4">🤖</div>
    <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Ready to assist!</h2>
    <p className="text-[var(--text-secondary)] max-w-md">
      Ask me anything and I'll help you analyze, code, or research.
    </p>
  </div>
);

const LoadingState = () => (
  <div className="flex-1 flex items-center justify-center">
    <div className="loading-spinner" />
    <span className="ml-2 text-[var(--text-secondary)]">Loading conversation...</span>
  </div>
);

// Enhanced Chat Header Component
const ChatHeader = ({ onSwitch, onReset }: ChatHeaderProps) => {
  const handleReset = useCallback(() => {
    console.log('🔄 Reset button clicked - performing comprehensive reset...');
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('activeChatId');
      localStorage.removeItem('activeNotebookId');
      localStorage.removeItem('activeChatId:updatedAt');
      localStorage.removeItem('activeNotebookChatId');
      
      console.log('📓 Clearing all notebook data...');
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('notebook_')) {
          console.log(`📓 Removing ${key}`);
          localStorage.removeItem(key);
        }
      });

      if ('BroadcastChannel' in window) {
        const chatBC = new BroadcastChannel('osslab-chat');
        chatBC.postMessage({ type: 'reset' });
        chatBC.close();

        const notebookBC = new BroadcastChannel('osslab-notebook');
        notebookBC.postMessage({ type: 'reset' });
        notebookBC.close();
      }
    }
    
    onReset();
    
    setTimeout(() => {
      console.log('🔄 Triggering hard refresh...');
      window.location.reload();
    }, 100);
  }, [onReset]);

  return (
    <div className="flex items-center gap-2 p-2 border-b border-[var(--ai-panel-border)] flex-col items-start">
      {/* Buttons */}
      <div className="flex items-center gap-2 w-full">
        <button
          onClick={onSwitch}
          className="px-3 py-1 text-sm bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] rounded"
          title="Switch to another conversation"
        >
          Switch
        </button>
        <button
          onClick={handleReset}
          className="px-3 py-1 text-sm bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] rounded"
          title="Reset chat and clear notebook"
        >
          Reset & Refresh
        </button>
      </div>

      {/* 👇 Permanent Hint — Always visible */}
      <div className="mt-2 w-full text-center text-xs text-blue-500 dark:text-blue-400 animate-pulse bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg border border-blue-100 dark:border-blue-800">
        <p className="flex items-center justify-center gap-1">
          <span className="text-lg">💡</span>
          <span>
            <strong className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-800 rounded mx-1">
              Ctrl+R
            </strong>
            to refresh if the app feels slow or unresponsive.
          </span>
        </p>
        <p className="mt-1 opacity-70">
          This is normal during heavy AI tasks — your data stays safe.
        </p>
      </div>
    </div>
  );
};

// Chat Pane Component
const ChatPane = ({ 
  chatId, 
  initialHistory, 
  isInputEnabled, 
  setIsInputEnabled 
}: { 
  chatId: string; 
  initialHistory: AgentMessage[];
  isInputEnabled: boolean;
  setIsInputEnabled: (enabled: boolean) => void;
}) => {
  const { messages, isLoading, sendMessage } = useAgentChat(chatId, initialHistory);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessageHandler = useCallback(async (message: string) => {
    try {
      console.log('📤 Sending message:', message);
      
      const result = await sendMessage(message);
      
      console.log('✅ Message sent successfully - notifying sidebar to clear files');
      
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('osslab-chat');
        bc.postMessage({ 
          type: 'message_sent',
          chatId: chatId,
          timestamp: new Date().toISOString()
        });
        bc.close();
      }
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('chatMessageSent', {
          detail: { chatId, message }
        }));
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      throw error;
    }
  }, [sendMessage, chatId]);

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch (err) {
      console.error('Failed to copy text:', err);
      toast.error('Failed to copy text');
    }
  }, []);

  const handleRegenerate = useCallback(() => {
    console.log('Regenerate last response');
    toast.info('Regenerate functionality coming soon');
  }, []);

  const showEmptyState = !isLoading && messages.length === 0;
  const showTyping = isLoading && messages[messages.length - 1]?.role === 'user';

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {showEmptyState && <EmptyState />}
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onCopy={handleCopy}
            onRegenerate={handleRegenerate}
          />
        ))}
        {showTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-4 border-t border-[var(--ai-panel-border)]">
        <EnhancedChatInput
          onSend={sendMessageHandler}
          isLoading={isLoading}
          disabled={!isInputEnabled}
          onFileUpload={() => setIsInputEnabled(true)}
          chatId={chatId}
        />
      </div>
    </>
  );
};

// Main AI Assistant Panel Component
export function AIAssistantPanel() {
  const { 
    chatId, 
    initialHistory, 
    isLoading, 
    isInputEnabled, 
    setIsInputEnabled,
    resetChat 
  } = useChatManager();
  const router = useRouter();

  const handleSwitch = useCallback(() => {
    try {
      resetChat();
      router.push('/library');
      toast.success('Switched to chat library');
    } catch (error) {
      console.error('Failed to switch chat:', error);
      toast.error('Failed to switch conversation');
    }
  }, [resetChat, router]);

  const handleReset = useCallback(() => {
    try {
      console.log('🔄 Reset initiated from AI Assistant Panel');
      resetChat();
      setIsInputEnabled(true);
      toast.success('Chat reset - refreshing page...');
    } catch (error) {
      console.error('Failed to reset chat:', error);
      toast.error('Failed to reset conversation');
    }
  }, [resetChat, setIsInputEnabled]);

  useEffect(() => {
    const handleWindowFocus = () => {
      setTimeout(() => {
        setIsInputEnabled(true);
      }, 500);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleWindowFocus);
      return () => window.removeEventListener('focus', handleWindowFocus);
    }
  }, [setIsInputEnabled]);

  // 👇 NEW CODE — ADD THIS BLOCK BELOW THE ABOVE useEffect
  useEffect(() => {
    // When returning to a chat (chatId changes), ensure input is enabled
    if (chatId) {
      setIsInputEnabled(true);
    }
  }, [chatId, setIsInputEnabled]);
  // 👆 END OF NEW CODE

  if (isLoading && !initialHistory) {
    return (
      <div className="flex-1 flex items-center bg-[var(--ai-panel-bg)] border-l border-[var(--ai-panel-border)]">
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[var(--ai-panel-bg)] border-l border-[var(--ai-panel-border)]">
      <ChatHeader onSwitch={handleSwitch} onReset={handleReset} />
      <ChatPane 
        chatId={chatId} 
        initialHistory={initialHistory || []} 
        isInputEnabled={isInputEnabled}
        setIsInputEnabled={setIsInputEnabled}
      />
    </div>
  );
}

export default AIAssistantPanel;
