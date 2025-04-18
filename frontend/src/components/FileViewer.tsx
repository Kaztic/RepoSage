import { useRef } from 'react';
import { CodeHighlighter } from './CodeHighlighter';
import { RelevantFile } from '../types';
import { TbX, TbMessagePlus } from 'react-icons/tb';

type FileViewerProps = {
  file: RelevantFile;
  onCopyToChat: (text: string) => void;
  onClose: () => void;
};

const FileViewer: React.FC<FileViewerProps> = ({ file, onCopyToChat, onClose }) => {
  const selectionPopupRef = useRef<HTMLDivElement>(null);
  const language = getLanguageFromPath(file.path);

  return (
    <div className="file-viewer w-full h-full flex flex-col overflow-hidden bg-surface-800">
      <div className="flex justify-between items-center p-3 border-b border-surface-700">
        <span className="text-sm font-medium text-primary-300">{file.path}</span>
        <div className="flex space-x-2">
          <button 
            onClick={() => onCopyToChat(`\`\`\`${language}:${file.path}\n${file.content}\n\`\`\``)}
            className="flex items-center text-xs px-2 py-1 rounded bg-primary-600 hover:bg-primary-700 text-white transition-colors"
            title="Add to chat"
          >
            <TbMessagePlus className="mr-1" />
            Add to Chat
          </button>
          <button 
            onClick={onClose}
            className="text-surface-400 hover:text-surface-200 p-1 rounded-full hover:bg-surface-700/50 transition-colors"
            title="Close"
          >
            <TbX size={20} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 text-sm">
        <CodeHighlighter 
          language={language}
          showLineNumbers={true}
          className="rounded shadow-md"
        >
          {file.content}
        </CodeHighlighter>
      </div>
    </div>
  );
};

// Helper function to determine language from file path
function getLanguageFromPath(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase() || '';
  
  const extensionMap: Record<string, string> = {
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
    'php': 'php',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'json': 'json',
    'md': 'markdown',
    'yml': 'yaml',
    'yaml': 'yaml',
    'sh': 'bash',
    'bash': 'bash',
    'sql': 'sql',
    'graphql': 'graphql',
    'swift': 'swift',
    'kt': 'kotlin',
    'rs': 'rust',
  };
  
  return extensionMap[extension] || 'text';
}

export default FileViewer; 