import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { RelevantFile } from '../types';

type FileViewerProps = {
  file: RelevantFile;
  width: string;
  onCopyToChat: (path: string) => void;
  onResizeStart: (e: React.MouseEvent) => void;
};

export default function FileViewer({ file, width, onCopyToChat, onResizeStart }: FileViewerProps) {
  // Helper function to get language from file path for syntax highlighting
  const getLanguageFromPath = (path: string): string => {
    const extension = path.split('.').pop() || '';
    const languageMap: {[key: string]: string} = {
      'js': 'javascript',
      'jsx': 'jsx',
      'ts': 'typescript',
      'tsx': 'tsx',
      'py': 'python',
      'rb': 'ruby',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust',
      'php': 'php',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'json': 'json',
      'md': 'markdown',
      'yml': 'yaml',
      'yaml': 'yaml',
      'xml': 'xml',
      'sh': 'bash',
      'bash': 'bash',
    };
    
    return languageMap[extension] || 'text';
  };

  return (
    <div className="relative">
      <div
        className="h-full overflow-auto border-r border-gray-800"
        style={{ width }}
      >
        <div className="p-4">
          <div className="flex justify-between items-center mb-4 sticky top-0 bg-gray-900 z-10 py-2">
            <h2 className="font-medium text-lg truncate">{file.path}</h2>
            <button
              onClick={() => onCopyToChat(file.path)}
              className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded"
              title="Copy path to chat"
            >
              Copy to Chat
            </button>
          </div>
          <div className="bg-gray-950 rounded overflow-hidden">
            <SyntaxHighlighter
              language={getLanguageFromPath(file.path)}
              style={atomDark}
              customStyle={{ margin: 0 }}
            >
              {file.content}
            </SyntaxHighlighter>
          </div>
        </div>
      </div>
      <div
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-gray-700 hover:bg-blue-500 opacity-50 hover:opacity-100"
        onMouseDown={onResizeStart}
      />
    </div>
  );
} 