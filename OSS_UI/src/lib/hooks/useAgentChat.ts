import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

interface FileContextData {
  name: string;
  path: string;
  absolutePath: string;
  filePath: string;
  fullPath: string;
  size: number;
}

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';
const WS_BASE = process.env.NEXT_PUBLIC_WS_BASE_URL || 'ws://127.0.0.1:8000';

// FIXED: Clear stale localStorage only once on app restart
let hasCleared = false;
if (typeof window !== 'undefined' && !hasCleared) {
  localStorage.removeItem('osslab_file_contexts');
  localStorage.removeItem('osslab_uploaded_files');
  localStorage.removeItem('osslab_dataset_files');
  console.log('🧹 CLEARED ALL STALE FILE CONTEXTS ON APP RESTART');
  hasCleared = true;
}

// FIXED: Unique ID generator for messages
const generateUniqueId = (prefix: string): string => {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${randomSuffix}`;
};

export function useAgentChat(chatId: string, initialHistory: AgentMessage[] = []) {
  const [messages, setMessages] = useState<AgentMessage[]>(initialHistory);
  const [isLoading, setIsLoading] = useState(false);
  const [currentChatId, setCurrentChatId] = useState(chatId);
  const wsRef = useRef<WebSocket | null>(null);
  const fallbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // WebSocket connection for real-time AI responses
  useEffect(() => {
    if (!currentChatId) return;

    const wsUrl = `${WS_BASE}/ws/${encodeURIComponent(currentChatId)}`;
    console.log(`🔗 Connecting to WebSocket: ${wsUrl}`);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log(`✅ WebSocket connected for chat: ${currentChatId}`);
    };

    ws.onmessage = (event) => {
      console.log('📨 Raw WebSocket message:', event.data);
      
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      
      try {
        const data = JSON.parse(event.data);
        console.log('📩 Parsed WebSocket data:', data);

        if (data.type === 'message_processed') {
          console.log('🎯 Processing AI response...');
          
          let content = '';
          
          if (data.result?.message?.content) {
            content = data.result.message.content;
          } else if (data.result?.agent_response?.content) {
            content = data.result.agent_response.content;
          } else if (data.result?.tool_call_message?.content) {
            content = data.result.tool_call_message.content;
          } else if (data.result?.confirmation_message?.content) {
            content = data.result.confirmation_message.content;
          } else if (data.result?.error_message?.content) {
            content = data.result.error_message.content;
          } else if (typeof data.result === 'string') {
            content = data.result;
          } else {
            content = 'AI response received';
          }

          // FIXED: Generate truly unique AI message ID
          const aiMessage: AgentMessage = {
            id: generateUniqueId('ai'),
            role: 'assistant',
            content: content,
            timestamp: data.timestamp || new Date().toISOString()
          };

          console.log('💬 Adding AI message:', aiMessage);
          setMessages(prev => [...prev, aiMessage]);
          setIsLoading(false);
          
        } else if (data.type === 'connection_established') {
          console.log('🔌 Connection established');
        }
      } catch (error) {
        console.error('❌ Failed to parse WebSocket message:', error);
        setIsLoading(false);
      }
    };

    ws.onclose = (event) => {
      console.log(`🔌 WebSocket disconnected for chat: ${currentChatId}`);
    };

    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      setIsLoading(false);
      toast.error('Connection error - please refresh');
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
      }
    };
  }, [currentChatId]);

  // Update messages when initialHistory changes
  useEffect(() => {
    if (initialHistory.length > 0) {
      console.log(`📚 Loading ${initialHistory.length} initial messages`);
      setMessages(initialHistory);
    }
  }, [initialHistory]);

  // Update chatId when it changes
  useEffect(() => {
    setCurrentChatId(chatId);
  }, [chatId]);

  // FIXED: Complete file path extraction with comprehensive validation
  const getCurrentSessionFilePaths = useCallback((): string[] => {
    try {
      console.log('📁 Extracting current session file paths...');
      
      // Get from primary localStorage key
      const currentFiles = JSON.parse(localStorage.getItem('osslab_dataset_files') || '[]') as FileContextData[];
      
      if (currentFiles.length === 0) {
        console.log('📂 No files found in localStorage');
        return [];
      }

      console.log('📁 Found files in localStorage:', currentFiles);

      // FIXED: Extract and validate full paths with comprehensive fallback
      const validPaths: string[] = [];

      currentFiles.forEach((fileContext: FileContextData, index: number) => {
        console.log(`📁 Processing file ${index + 1}:`, fileContext);

        // Try multiple path properties in order of preference
        const possiblePaths = [
          fileContext.absolutePath,
          fileContext.fullPath,
          fileContext.filePath,
          fileContext.path
        ];

        let validPath: string | null = null;

        for (const path of possiblePaths) {
          if (path && typeof path === 'string' && path.trim()) {
            // Validate it's actually a full path (contains separators)
            if (path.includes('\\') || path.includes('/')) {
              // Ensure it's not wrapped in brackets or has weird formatting
              const cleanPath = path.replace(/^\[File:\s*/, '').replace(/\]$/, '').trim();
              if (cleanPath !== path) {
                console.log('📁 Cleaned wrapped path:', path, '→', cleanPath);
              }
              validPath = cleanPath;
              break;
            }
          }
        }

        if (validPath) {
          console.log('✅ Valid path extracted:', validPath);
          validPaths.push(validPath);
        } else {
          console.warn('⚠️ No valid path found for file:', fileContext);
        }
      });

      console.log('📎 Final extracted paths for AI:', validPaths);
      return validPaths;

    } catch (error) {
      console.error('❌ Error extracting file paths:', error);
      return [];
    }
  }, []);

  // FIXED: Complete sendMessage function with unique IDs and clean file paths
  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim() || isLoading) {
      console.log('⏸️ Message sending blocked');
      return;
    }

    console.log('📤 Starting to send message:', message);
    setIsLoading(true);

    // FIXED: Generate truly unique user message ID
    const userMessage: AgentMessage = {
      id: generateUniqueId('user'),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      // FIXED: Get current session file paths with validation
      const currentFilePaths: string[] = getCurrentSessionFilePaths();
      let fullMessage = message;
      
      // FIXED: Include clean file paths in AI context
      if (currentFilePaths.length > 0) {
        const contextString = currentFilePaths
          .map((path: string) => `[DATASET_FILE: ${path}]`)
          .join('\n');
        
        fullMessage = `${message}\n\n--- Available Dataset Files ---\n${contextString}`;
        
        console.log('📎 Added file context to message:');
        console.log('📂 Number of files:', currentFilePaths.length);
        console.log('📂 Files:', currentFilePaths);
        console.log('📤 Full message with context:', fullMessage);
      } else {
        console.log('📂 No files to include in context');
      }

      // Create new chat if needed
      let activeChatId = currentChatId;
      if (!activeChatId || activeChatId === 'default' || activeChatId === '') {
        console.log('🆕 Creating new chat session...');
        
        const createResponse = await fetch(`${API_BASE}/api/chat/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (createResponse.ok) {
          const createData = await createResponse.json();
          activeChatId = createData.chat_id;
          setCurrentChatId(activeChatId);
          
          localStorage.setItem('activeChatId', activeChatId);
          localStorage.setItem('activeChatId:updatedAt', String(Date.now()));
          
          if ('BroadcastChannel' in window) {
            const bc = new BroadcastChannel('osslab-chat');
            bc.postMessage({ type: 'switch', chatId: activeChatId });
            bc.close();
          }
          
          console.log('✅ New chat created:', activeChatId);
        } else {
          throw new Error('Failed to create new chat');
        }
      }

      // Send message to API
      const requestPayload = {
        chat_id: activeChatId,
        message: fullMessage,
        web_search_enabled: false
      };

      console.log('🚀 Sending to API:', {
        chat_id: requestPayload.chat_id,
        message_length: requestPayload.message.length,
        files_included: currentFilePaths.length,
        web_search: requestPayload.web_search_enabled
      });

      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Chat API response received');

      // Fallback timer for WebSocket timeout
      fallbackTimerRef.current = setTimeout(() => {
        if (isLoading) {
          console.log('⏰ WebSocket timeout - using HTTP fallback');
          
          let fallbackContent = '';
          
          if (data.message) {
            fallbackContent = data.message;
          } else if (data.response_type === 'text' && data.message) {
            fallbackContent = data.message;
          } else if (data.response_type === 'tool_call' && data.agent_result) {
            fallbackContent = data.agent_result;
          } else {
            fallbackContent = 'Response received successfully';
          }

          // FIXED: Generate unique fallback message ID
          const fallbackMessage: AgentMessage = {
            id: generateUniqueId('fallback'),
            role: 'assistant',
            content: fallbackContent,
            timestamp: new Date().toISOString()
          };
          
          setMessages(prev => [...prev, fallbackMessage]);
          setIsLoading(false);
        }
      }, 10000);

    } catch (error) {
      console.error('❌ Failed to send message:', error);
      toast.error('Failed to send message - please try again');
      setIsLoading(false);
      
      // Remove user message on error
      setMessages(prev => prev.filter(msg => msg.id !== userMessage.id));
    }
  }, [currentChatId, isLoading, getCurrentSessionFilePaths]);

  return {
    messages,
    isLoading,
    sendMessage,
    setMessages,
    chatId: currentChatId
  };
}
