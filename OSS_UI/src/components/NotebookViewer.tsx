// src/components/NotebookViewer.tsx
'use client';
import { NotebookCell } from '@/lib/hooks/useAgentChat';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';

interface NotebookViewerProps {
  cells: NotebookCell[];
}

const NotebookViewer = ({ cells }: NotebookViewerProps) => {
  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full bg-bg-primary text-text-primary">
      <h1 className="text-3xl font-bold border-b border-input-border pb-2">Analysis Notebook</h1>
      {cells.map((cell) => (
        <div key={cell.cellNumber} className="bg-bg-secondary rounded-lg shadow-md">
          <div className="p-1 bg-bg-tertiary rounded-t-lg text-xs text-text-secondary">Cell #{cell.cellNumber} [{cell.type}]</div>
          <div className="p-4">
            {cell.type === 'markdown' && (
              // FIX: Wrap the component in a div to apply styling.
              <div className="prose prose-invert max-w-none">
                <ReactMarkdown>{cell.content}</ReactMarkdown>
              </div>
            )}
            {cell.type === 'code' && (
              <SyntaxHighlighter language="python" style={vscDarkPlus} showLineNumbers>
                {cell.content}
              </SyntaxHighlighter>
            )}
            {cell.type === 'conclusion' && <div className="p-4 bg-cyan-accent/10 border-l-4 border-cyan-accent rounded-md"><p className="font-bold text-lg">Conclusion</p><p className="mt-2">{cell.content}</p></div>}
          </div>
        </div>
      ))}
    </div>
  );
};

export default NotebookViewer;