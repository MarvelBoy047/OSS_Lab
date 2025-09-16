'use client';
import { useEffect, useState, useMemo } from 'react'; // ✅ ADDED useMemo
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

// Interface definitions (no changes needed here)
interface NotebookOutput {
  output_type: string;
  data?: {
    'text/plain'?: string[];
    'text/html'?: string[];
    'image/png'?: string;
    'image/jpeg'?: string;
    'application/json'?: any;
  };
  text?: string[];
  name?: string;
  execution_count?: number;
}
interface NotebookCell {
  cell_type: string;
  source: string[];
  outputs?: NotebookOutput[];
  execution_count?: number;
}
interface NotebookData {
  chat_id: string;
  notebook_file: string;
  notebook_content: {
    cells: NotebookCell[];
    metadata: any;
  };
  created_at: string;
}

function OutputRenderer({ output }: { output: NotebookOutput }) {
  const { theme } = useTheme();

  if (output.output_type === 'display_data' || output.output_type === 'execute_result') {
    const data = output.data;
    if (!data) return null;

    // Render images (matplotlib plots, etc.)
    if (data['image/png'] || data['image/jpeg']) {
      const imageType = data['image/png'] ? 'png' : 'jpeg';
      const imageData = data[`image/${imageType}`];

      return (
        <div className="output-image-container">
          <img
            src={`data:image/${imageType};base64,${imageData}`}
            alt="Plot output"
            className="max-w-full h-auto rounded-lg shadow-lg border border-[var(--border-primary)] hover-glow transition-all duration-200"
            style={{ maxHeight: '500px', objectFit: 'contain' }}
          />
        </div>
      );
    }

    // Render HTML content
    if (data['text/html']) {
      return (
        <div className="output-html-container">
          <div
            className="bg-[var(--bg-secondary)] p-4 rounded-lg border border-[var(--border-primary)] overflow-auto"
            dangerouslySetInnerHTML={{
              __html: Array.isArray(data['text/html'])
                ? data['text/html'].join('')
                : data['text/html']
            }}
          />
        </div>
      );
    }

    // Render JSON data with syntax highlighting
    if (data['application/json']) {
      return (
        <div className="output-json-container">
          <SyntaxHighlighter
            language="json"
            style={theme === 'dark' ? oneDark : oneLight}
            className="rounded-lg border border-[var(--border-primary)]"
            customStyle={{
              margin: 0,
              backgroundColor: 'transparent',
              fontSize: '14px',
              lineHeight: '1.5'
            }}
            wrapLongLines={true}
          >
            {JSON.stringify(data['application/json'], null, 2)}
          </SyntaxHighlighter>
        </div>
      );
    }

    // Render plain text
    if (data['text/plain']) {
      const textContent = Array.isArray(data['text/plain'])
        ? data['text/plain'].join('')
        : data['text/plain'];

      return (
        <div className="output-text-container">
          <pre className="bg-[var(--bg-tertiary)] p-4 rounded-lg border border-[var(--border-primary)] text-[var(--text-primary)] text-sm overflow-x-auto whitespace-pre-wrap font-mono">
            {textContent}
          </pre>
        </div>
      );
    }
  }

  // Handle stream output (print statements, etc.)
  if (output.output_type === 'stream') {
    const text = Array.isArray(output.text) ? output.text.join('') : output.text || '';
    return (
      <div className="output-stream-container">
        <div className="bg-[var(--bg-tertiary)] p-4 rounded-lg border border-[var(--border-primary)]">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-[var(--cyan-accent)] text-sm">terminal</span>
            <span className="text-xs text-[var(--text-secondary)] font-medium uppercase tracking-wide">
              {output.name || 'stdout'}
            </span>
          </div>
          <pre className="text-[var(--text-primary)] text-sm whitespace-pre-wrap overflow-x-auto font-mono">
            {text}
          </pre>
        </div>
      </div>
    );
  }

  // Handle error output
  if (output.output_type === 'error') {
    const errorText = Array.isArray(output.text) ? output.text.join('') : output.text || '';
    return (
      <div className="output-error-container">
        <div className="bg-[var(--red-accent)]/10 border border-[var(--red-accent)]/30 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-[var(--red-accent)] text-sm">error</span>
            <span className="text-xs text-[var(--red-accent)] font-medium uppercase tracking-wide">Error</span>
          </div>
          <pre className="text-[var(--red-accent)] text-sm whitespace-pre-wrap overflow-x-auto font-mono">
            {errorText}
          </pre>
        </div>
      </div>
    );
  }

  return null;
}

function CodeCell({ cell, index }: { cell: NotebookCell; index: number }) {
  const { theme } = useTheme();
  const code = Array.isArray(cell.source) ? cell.source.join('') : cell.source;

  return (
    <div className="cell-container code-cell">
      <div className="cell-header">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[var(--cyan-accent)]">code</span>
            <span className="text-sm font-medium text-[var(--text-primary)]">
              Code Cell {index + 1}
            </span>
          </div>
          {cell.execution_count && (
            <span className="px-3 py-1 bg-[var(--cyan-accent)]/10 text-[var(--cyan-accent)] text-xs rounded-full font-mono border border-[var(--cyan-accent)]/20">
              [{cell.execution_count}]
            </span>
          )}
        </div>
      </div>

      <div className="cell-content">
        <div className="code-input-section">
          <SyntaxHighlighter
            language="python"
            style={theme === 'dark' ? oneDark : oneLight}
            className="rounded-lg"
            customStyle={{
              margin: 0,
              backgroundColor: 'transparent',
              fontSize: '14px',
              lineHeight: '1.5'
            }}
            showLineNumbers={true}
            wrapLongLines={true}
          >
            {code}
          </SyntaxHighlighter>
        </div>

        {cell.outputs && cell.outputs.length > 0 && (
          <div className="code-output-section">
            <div className="output-header">
              <span className="material-symbols-outlined text-[var(--green-accent)] text-sm">play_arrow</span>
              <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Output</span>
            </div>
            <div className="space-y-4">
              {cell.outputs.map((output, outputIndex) => (
                <OutputRenderer key={outputIndex} output={output} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MarkdownCell({ cell, index }: { cell: NotebookCell; index: number }) {
  const content = Array.isArray(cell.source) ? cell.source.join('') : cell.source;

  return (
    <div className="cell-container markdown-cell">
      <div className="cell-header">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[var(--green-accent)]">description</span>
          <span className="text-sm font-medium text-[var(--text-primary)]">
            Markdown Cell {index + 1}
          </span>
        </div>
      </div>

      <div className="cell-content">
        <div className="prose prose-sm max-w-none text-[var(--text-primary)]
                        prose-headings:text-[var(--text-primary)]
                        prose-p:text-[var(--text-primary)]
                        prose-strong:text-[var(--text-primary)]
                        prose-em:text-[var(--text-primary)]
                        prose-code:text-[var(--cyan-accent)]
                        prose-code:bg-[var(--bg-tertiary)]
                        prose-code:px-1
                        prose-code:py-0.5
                        prose-code:rounded
                        prose-pre:bg-[var(--bg-tertiary)]
                        prose-pre:border-[var(--border-primary)]
                        prose-pre:rounded-lg
                        prose-ul:text-[var(--text-primary)]
                        prose-ol:text-[var(--text-primary)]
                        prose-li:text-[var(--text-primary)]
                        prose-blockquote:text-[var(--text-secondary)]
                        prose-blockquote:border-[var(--border-primary)]
                        prose-a:text-[var(--cyan-accent)]
                        prose-a:no-underline
                        hover:prose-a:underline
                        dark:prose-invert">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

function NotebookEmptyState() {
  return (
    <div className="notebook-empty-state">
      <div className="text-center">
        <div className="relative">
          <span className="material-symbols-outlined text-6xl mb-4 text-[var(--text-secondary)] block">menu_book</span>
          <div className="absolute inset-0 bg-[var(--cyan-accent)]/20 rounded-full blur-xl opacity-50"></div>
        </div>
        <h2 className="text-2xl font-bold mb-2 premium-white">No Notebook Available</h2>
        <p className="text-[var(--text-secondary)] mb-4 max-w-md mx-auto">
          Select a conversation with analysis to view its notebook, or start a new conversation to generate one.
        </p>
        <div className="text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)] px-3 py-2 rounded-full inline-block">
          Notebooks are generated during data analysis and visualization tasks
        </div>
      </div>
    </div>
  );
}

function NotebookHeader({ notebookData, activeChatId, codeCount, markdownCount }: {
  notebookData: NotebookData;
  activeChatId: string | null;
  codeCount: number;
  markdownCount: number;
}) {
  return (
    <div className="notebook-header">
      <div className="flex items-center gap-4">
        <div className="relative">
          <span className="material-symbols-outlined text-[var(--cyan-accent)] text-2xl">menu_book</span>
          <div className="absolute inset-0 bg-[var(--cyan-accent)]/20 rounded-full blur-md"></div>
        </div>
        <div>
          <h1 className="text-2xl font-bold premium-white">Analysis Notebook</h1>
          <p className="text-[var(--text-secondary)] text-sm">
            {notebookData.notebook_file} • {codeCount} code • {markdownCount} markdown
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {activeChatId && (
          <div className="px-3 py-1 bg-[var(--bg-secondary)] rounded-full border border-[var(--border-primary)] hover:border-[var(--border-secondary)] transition-colors">
            <span className="text-xs text-[var(--text-secondary)] font-mono">ID: {activeChatId.slice(0, 8)}</span>
          </div>
        )}
        <button className="px-4 py-2 bg-[var(--cyan-accent)] text-black rounded-lg hover:opacity-80 transition-all duration-200 text-sm font-medium shadow-lg hover:shadow-xl">
          Export
        </button>
      </div>
    </div>
  );
}

// Main component - This is where the changes are.
export default function NotebookDisplay() {
  const [notebookData, setNotebookData] = useState<NotebookData | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const pathname = usePathname();

  // No changes to the hooks (clearNotebook, useEffects, fetchNotebookData)
  const clearNotebook = () => {
    console.log('📓 Clearing notebook state...');
    setNotebookData(null);
    setActiveChatId(null);
    setIsLoading(false);

    // Clear notebook-related localStorage
    localStorage.removeItem('activeNotebookChatId');
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('notebook_')) {
        console.log(`📓 Removing ${key} from localStorage`);
        localStorage.removeItem(key);
      }
    });

    console.log('✅ Notebook cleared successfully');
  };

  useEffect(() => {
    if (!('BroadcastChannel' in window)) return;

    // Listen for chat reset events
    const chatBC = new BroadcastChannel('osslab-chat');
    chatBC.onmessage = (event) => {
      if (event.data?.type === 'reset') {
        console.log('📓 Received chat reset - clearing notebook');
        clearNotebook();
      }
    };

    // Listen for specific notebook reset events
    const notebookBC = new BroadcastChannel('osslab-notebook');
    notebookBC.onmessage = (event) => {
      if (event.data?.type === 'reset') {
        console.log('📓 Received notebook reset');
        clearNotebook();
      } else if (event.data?.type === 'notebook_loaded') {
        // Handle notebook loaded event
        const { chatId, notebookData: newNotebookData } = event.data;
        console.log('📓 Received notebook loaded event:', chatId);
        setNotebookData(newNotebookData);
        setActiveChatId(chatId);
      }
    };

    return () => {
      chatBC.close();
      notebookBC.close();
    };
  }, []);

  const fetchNotebookData = async (chatId: string) => {
    if (!chatId) return;

    setIsLoading(true);
    try {
      console.log(`📓 Fetching notebook for chat: ${chatId}`);
      const response = await fetch(`${API_BASE}/api/conversation/${chatId}/notebook`);

      if (response.ok) {
        const notebookData = await response.json();
        console.log('📓 Notebook data fetched successfully:', notebookData.notebook_file);

        setNotebookData(notebookData);
        setActiveChatId(chatId);

        // Store in localStorage for persistence
        localStorage.setItem(`notebook_${chatId}`, JSON.stringify(notebookData));
        localStorage.setItem('activeNotebookChatId', chatId);
      } else {
        console.log('📓 No notebook found for chat:', chatId);
        setNotebookData(null);
        setActiveChatId(null);
      }
    } catch (error) {
      console.error('❌ Failed to fetch notebook:', error);
      setNotebookData(null);
      setActiveChatId(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!('BroadcastChannel' in window)) return;

    const notebookChannel = new BroadcastChannel('notebook');
    notebookChannel.onmessage = (evt) => {
      console.log('📓 Notebook channel event:', evt.data);

      if (evt.data?.type === 'notebook_created') {
        console.log('📓 New notebook detected for chat:', evt.data.chat_id);
        fetchNotebookData(evt.data.chat_id);
      }
    };

    return () => notebookChannel.close();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if we should load a notebook
    const storedChatId = localStorage.getItem('activeNotebookChatId');
    const activeChatFromStorage = localStorage.getItem('activeChatId');

    if (storedChatId) {
      // Try to load from localStorage first
      const storedNotebook = localStorage.getItem(`notebook_${storedChatId}`);
      if (storedNotebook) {
        try {
          const parsedNotebook = JSON.parse(storedNotebook);
          setNotebookData(parsedNotebook);
          setActiveChatId(storedChatId);
          console.log('📓 Loaded notebook from localStorage:', parsedNotebook.notebook_file);
        } catch (error) {
          console.error('❌ Error parsing stored notebook:', error);
          localStorage.removeItem(`notebook_${storedChatId}`);
          localStorage.removeItem('activeNotebookChatId');
        }
      } else {
        // If not in localStorage, try to fetch from API
        fetchNotebookData(storedChatId);
      }
    } else if (activeChatFromStorage) {
      // Try to load notebook for current active chat
      fetchNotebookData(activeChatFromStorage);
    } else {
      // No active chat - clear notebook state
      clearNotebook();
    }
  }, [pathname]);


  // ✅ THIS IS THE FIX: Filter out failed cells
  // We use useMemo to ensure this filtering logic only runs when the notebookData changes.
  const filteredCells = useMemo(() => {
    if (!notebookData) return [];

    const allCells = notebookData.notebook_content?.cells || [];

    // The filtering logic:
    return allCells.filter(cell => {
      // Always keep markdown cells
      if (cell.cell_type === 'markdown') {
        return true;
      }
      // For code cells, check their outputs
      if (cell.cell_type === 'code') {
        // If there are no outputs, keep the cell (it might be unexecuted)
        if (!cell.outputs || cell.outputs.length === 0) {
          return true;
        }
        // Check if any output has the type 'error'.
        const hasError = cell.outputs.some(output => output.output_type === 'error');
        // Only return the cell if it does NOT have an error.
        return !hasError;
      }
      // Keep any other cell types by default
      return true;
    });
  }, [notebookData]); // Dependency array: only re-run when notebookData is updated

  if (isLoading) {
    return (
      <div className="notebook-empty-state">
        <div className="text-center">
          <div className="relative">
            <span className="material-symbols-outlined text-4xl mb-4 text-[var(--text-secondary)] block animate-spin">refresh</span>
          </div>
          <h2 className="text-xl font-bold mb-2 premium-white">Loading Notebook...</h2>
          <p className="text-[var(--text-secondary)]">Fetching analysis data...</p>
        </div>
      </div>
    );
  }

  if (!notebookData) {
    return <NotebookEmptyState />;
  }

  // ✅ MODIFIED: Use the filteredCells for calculations and rendering
  const codeCount = filteredCells.filter(c => c.cell_type === 'code').length;
  const markdownCount = filteredCells.filter(c => c.cell_type === 'markdown').length;

  return (
    <div className="notebook-container">
      <NotebookHeader
        notebookData={notebookData}
        activeChatId={activeChatId}
        codeCount={codeCount}
        markdownCount={markdownCount}
      />

      <div className="notebook-content">
        {/* ✅ MODIFIED: Map over the new filteredCells array instead of the original one */}
        {filteredCells.map((cell, index) => {
          if (cell.cell_type === 'code') {
            return <CodeCell key={`code-${index}`} cell={cell} index={index} />;
          } else if (cell.cell_type === 'markdown') {
            return <MarkdownCell key={`markdown-${index}`} cell={cell} index={index} />;
          }
          return null;
        })}

        {filteredCells.length === 0 && (
          <div className="text-center py-8 text-[var(--text-secondary)]">
            <span className="material-symbols-outlined text-4xl mb-2 block">note</span>
            <p>This notebook appears to be empty.</p>
          </div>
        )}
      </div>
    </div>
  );
}
