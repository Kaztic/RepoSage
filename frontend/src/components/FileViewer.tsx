import { useRef } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { RelevantFile } from '../types';
import { getLanguageFromPath } from '../utils/diffUtils';

type FileViewerProps = {
  file: RelevantFile;
  onCopyToChat: (text: string) => void;
  onClose: () => void;
};

export default function FileViewer({ file, onCopyToChat, onClose }: FileViewerProps) {
  const selectionPopupRef = useRef<HTMLDivElement>(null);

  return (
    <div className="border-l border-gray-700 overflow-hidden bg-gray-800 flex flex-col">
      <div className="p-2 border-b border-gray-700 font-mono text-sm flex justify-between items-center">
        <span className="truncate">{file.path}</span>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white px-2"
        >
          ×
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 font-mono text-sm">
          <div className="flex justify-between items-center mb-3">
            <span className="text-gray-300">File content:</span>
            <button 
              onClick={() => onCopyToChat(file.path)}
              className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-blue-300"
              title="Add file path to chat input"
            >
              Add to chat
            </button>
          </div>
          <div 
            className="relative" 
            onMouseUp={(e) => {
              const selection = window.getSelection();
              if (selection && selection.toString().trim() !== '') {
                // Show selection popup
                const selectionRect = selection.getRangeAt(0).getBoundingClientRect();
                if (selectionPopupRef.current) {
                  selectionPopupRef.current.style.display = 'block';
                  selectionPopupRef.current.style.left = `${selectionRect.left + (selectionRect.width / 2) - 50}px`;
                  selectionPopupRef.current.style.top = `${selectionRect.top - 40}px`;
                }
              }
            }}
          >
            <SyntaxHighlighter
              language={getLanguageFromPath(file.path)}
              style={atomDark}
              showLineNumbers
              customStyle={{ background: 'transparent', margin: 0 }}
            >
              {file.content}
            </SyntaxHighlighter>
            <div 
              id="selection-popup" 
              ref={selectionPopupRef}
              className="absolute hidden z-10 bg-gray-800 rounded shadow-lg border border-gray-700 py-1 px-2"
            >
              <button 
                className="text-xs text-blue-300 hover:text-blue-200"
                onClick={() => {
                  const selection = window.getSelection();
                  if (selection && selection.toString().trim() !== '') {
                    onCopyToChat(selection.toString());
                    if (selectionPopupRef.current) {
                      selectionPopupRef.current.style.display = 'none';
                    }
                  }
                }}
              >
                Add selection to chat
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 