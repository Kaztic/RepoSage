import { FaSpinner } from 'react-icons/fa';
import CodeHighlighter from './CodeHighlighter';
import { Commit } from '../types';
import { getLanguageFromPath, parseDiffToSideBySide, renderDiffBlock } from '../utils/diffUtils';

type CommitViewerProps = {
  commit: Commit;
  onCopyToChat: (text: string) => void;
  onClose: () => void;
  onFetchFileContent: (commitHash: string, filePath: string, fileIndex: number) => void;
  onToggleFileDiff: (commitHash: string, filePath: string, fileIndex: number) => void;
  onToggleFileContent: (commitHash: string, filePath: string, fileIndex: number) => void;
};

export default function CommitViewer({
  commit,
  onCopyToChat,
  onClose,
  onFetchFileContent,
  onToggleFileDiff,
  onToggleFileContent
}: CommitViewerProps) {
  return (
    <div className="border-l border-gray-700 overflow-hidden bg-gray-800 flex flex-col">
      <div className="p-2 border-b border-gray-700 font-mono text-sm flex justify-between items-center">
        <span className="truncate">Commit: {commit.short_hash}</span>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white px-2"
        >
          ×
        </button>
      </div>
      
      <div className="p-4 overflow-y-auto">
        <h3 className="text-lg font-semibold mb-2">{commit.message}</h3>
        <div className="text-sm text-gray-400 mb-4">
          <div>Author: {commit.author}</div>
          <div>Date: {new Date(commit.date).toLocaleString()}</div>
          <div className="flex items-center">
            <span>Commit: {commit.short_hash}</span>
            <span className="ml-2 text-xs text-gray-500 hidden md:inline truncate max-w-xs" title={commit.hash}>
              (Full: {commit.hash})
            </span>
            <button 
              onClick={() => onCopyToChat(commit.hash)}
              className="ml-2 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-blue-300"
              title="Copy full hash to chat input"
            >
              Copy to Chat
            </button>
          </div>
        </div>
        
        <h4 className="font-medium mb-2 text-gray-300">Files Changed</h4>
        <div className="space-y-2">
          {commit.file_changes && commit.file_changes.map((file: any, idx: number) => (
            <div key={idx} className={`p-2 rounded text-sm ${
              file.change_type === 'added' ? 'bg-green-900/20 border-l-2 border-green-500' :
              file.change_type === 'deleted' ? 'bg-red-900/20 border-l-2 border-red-500' :
              file.change_type === 'renamed' ? 'bg-blue-900/20 border-l-2 border-blue-500' :
              'bg-yellow-900/20 border-l-2 border-yellow-500'
            }`}>
              <div className="flex justify-between items-center">
                <span className="truncate">{file.path}</span>
                <span className="text-xs">
                  {file.insertions > 0 && <span className="text-green-400">+{file.insertions} </span>}
                  {file.deletions > 0 && <span className="text-red-400">-{file.deletions}</span>}
                </span>
              </div>
              <div className="flex space-x-2 mt-1">
                <button 
                  onClick={() => onToggleFileContent(commit.short_hash, file.path, idx)}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  {file.displayContent ? 'Hide file content' : 'View file content'}
                </button>
                <button 
                  onClick={() => onToggleFileDiff(commit.short_hash, file.path, idx)}
                  className="text-xs text-purple-400 hover:text-purple-300"
                >
                  {file.showDiff ? 'Hide diff' : 'View diff'}
                </button>
              </div>
              {file.loading && (
                <div className="mt-2 flex justify-center">
                  <FaSpinner className="animate-spin text-gray-400" />
                </div>
              )}
              {file.showDiff && file.diff && (
                <div className="mt-2 bg-gray-900/50 p-2 rounded overflow-x-auto">
                  {/* Check for binary file or encoding errors first */}
                  {file.diff === "Binary file or encoding error" || 
                   file.diff.includes("Binary file") ? (
                    <div className="p-3 bg-gray-800 text-amber-300 rounded">
                      <span className="font-medium">Cannot display diff:</span> This appears to be a binary file or has encoding issues
                    </div>
                  ) : (
                    /* GitHub-like diff display for text files */
                    <div className="diff-container">
                      {parseDiffToSideBySide(file.diff).map((diffBlock, blockIdx) => (
                        renderDiffBlock(diffBlock, file.path, blockIdx)
                      ))}
                    </div>
                  )}
                </div>
              )}
              {file.displayContent && (
                <div className="mt-2 bg-gray-900/50 p-2 rounded overflow-x-auto">
                  <CodeHighlighter
                    language={getLanguageFromPath(file.path)}
                    customStyle={{ margin: 0 }}
                  >
                    {file.displayContent}
                  </CodeHighlighter>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 