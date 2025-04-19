import { FaSpinner } from 'react-icons/fa';
import { TbMessagePlus, TbX } from 'react-icons/tb';
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
    <div className="border-l border-surface-700 overflow-hidden bg-surface-800 flex flex-col h-full">
      <div className="p-3 border-b border-surface-700 font-mono text-sm flex justify-between items-center bg-surface-900">
        <div className="flex items-center overflow-hidden">
          <span className="text-primary-400 mr-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 2a1 1 0 00-1 1v1a1 1 0 002 0V3a1 1 0 00-1-1zM4 4h3a3 3 0 006 0h3a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm2.5 7a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm2.45 4a2.5 2.5 0 10-4.9 0h4.9zM12 9a1 1 0 100 2h3a1 1 0 100-2h-3zm-1 4a1 1 0 011-1h2a1 1 0 110 2h-2a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </span>
          <span className="truncate text-surface-200">Commit: {commit.short_hash}</span>
        </div>
        <button
          onClick={onClose}
          className="text-surface-400 hover:text-surface-200 p-1 rounded-full hover:bg-surface-700/50 transition-colors"
          aria-label="Close commit viewer"
        >
          <TbX size={20} />
        </button>
      </div>
      
      <div className="overflow-y-auto p-4 bg-surface-900 flex-1">
        <div className="max-w-3xl mx-auto">
          {/* Commit Header */}
          <div className="mb-6 bg-surface-800/80 rounded-lg border border-surface-700/50 p-4 shadow-subtle">
            <h3 className="text-lg font-semibold mb-3 text-surface-100">{commit.message}</h3>
            <div className="grid grid-cols-2 gap-4 text-sm mb-3">
              <div>
                <div className="text-surface-400 mb-1">Author</div>
                <div className="text-surface-200">{commit.author}</div>
              </div>
              <div>
                <div className="text-surface-400 mb-1">Date</div>
                <div className="text-surface-200">{new Date(commit.date).toLocaleString()}</div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center mt-4 border-t border-surface-700/50 pt-3">
              <div className="flex-1 mb-2 sm:mb-0 min-w-0">
                <div className="text-surface-400 text-sm mb-1">Commit Hash</div>
                <div className="flex items-center flex-wrap">
                  <span className="font-mono text-primary-400 text-sm mr-2 break-all">{commit.short_hash}</span>
                  <span className="text-xs text-surface-500 truncate" title={commit.hash}>
                    (Full: {commit.hash.substring(0, 20)}...)
                  </span>
                </div>
              </div>
              <button 
                onClick={() => onCopyToChat(commit.hash)}
                className="px-3 py-1.5 text-xs bg-primary-600/20 hover:bg-primary-600/40 rounded text-primary-300 hover:text-primary-200 border border-primary-700/30 transition-colors duration-200 flex items-center whitespace-nowrap mt-1 sm:mt-0"
                title="Copy full hash to chat input"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                  <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                </svg>
                Copy to Chat
              </button>
            </div>
          </div>
          
          {/* Changes Section */}
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-surface-200 font-medium">Files Changed</h4>
            <div className="flex items-center text-xs space-x-2 text-surface-400">
              <div className="flex items-center">{commit.stats.files_changed} files</div>
              {commit.stats.insertions > 0 && <div className="text-green-400">+{commit.stats.insertions}</div>}
              {commit.stats.deletions > 0 && <div className="text-red-400">-{commit.stats.deletions}</div>}
            </div>
          </div>
          
          {/* File Changes */}
          <div className="space-y-4">
            {commit.file_changes && commit.file_changes.map((file: any, idx: number) => (
              <div key={idx} className={`rounded-lg overflow-hidden border ${
                file.change_type === 'added' ? 'border-green-500/20 bg-green-900/10' :
                file.change_type === 'deleted' ? 'border-red-500/20 bg-red-900/10' :
                file.change_type === 'renamed' ? 'border-blue-500/20 bg-blue-900/10' :
                'border-yellow-500/20 bg-yellow-900/10'
              }`}>
                {/* File header */}
                <div className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between bg-surface-800/80 border-b border-surface-700/50">
                  <div className="flex-1 mb-2 sm:mb-0">
                    <div className="flex items-center">
                      {file.change_type === 'added' && (
                        <span className="text-green-400 mr-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                      {file.change_type === 'deleted' && (
                        <span className="text-red-400 mr-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                      {file.change_type === 'renamed' && (
                        <span className="text-blue-400 mr-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
                          </svg>
                        </span>
                      )}
                      {file.change_type === 'modified' && (
                        <span className="text-yellow-400 mr-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                        </span>
                      )}
                      <span className="font-mono text-sm truncate text-surface-200">{file.path}</span>
                    </div>
                  </div>
                  <div className="flex items-center text-xs space-x-2">
                    {file.insertions > 0 && <span className="text-green-400">+{file.insertions}</span>}
                    {file.deletions > 0 && <span className="text-red-400">-{file.deletions}</span>}
                  </div>
                </div>
                
                {/* Action buttons */}
                <div className="flex p-2 bg-surface-800/50 border-b border-surface-700/30 space-x-2">
                  <button 
                    onClick={() => onToggleFileContent(commit.short_hash, file.path, idx)}
                    className={`text-xs px-2.5 py-1 rounded transition-colors duration-200 flex items-center
                      ${file.displayContent 
                        ? 'bg-primary-600/40 text-primary-200 hover:bg-primary-600/30' 
                        : 'text-surface-300 hover:text-surface-200 hover:bg-surface-700/50'}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" />
                    </svg>
                    {file.displayContent ? 'Hide content' : 'View content'}
                  </button>
                  <button 
                    onClick={() => onToggleFileDiff(commit.short_hash, file.path, idx)}
                    className={`text-xs px-2.5 py-1 rounded transition-colors duration-200 flex items-center
                      ${file.showDiff 
                        ? 'bg-primary-600/40 text-primary-200 hover:bg-primary-600/30' 
                        : 'text-surface-300 hover:text-surface-200 hover:bg-surface-700/50'}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" />
                    </svg>
                    {file.showDiff ? 'Hide diff' : 'View diff'}
                  </button>
                </div>
                
                {/* Loading state */}
                {file.loading && (
                  <div className="p-4 flex justify-center">
                    <FaSpinner className="animate-spin text-xl text-primary-400" />
                  </div>
                )}
                
                {/* Diff content */}
                {file.showDiff && file.diff && (
                  <div className="overflow-x-auto">
                    {/* Check for binary file or encoding errors first */}
                    {file.diff === "Binary file or encoding error" || 
                     file.diff.includes("Binary file") ? (
                      <div className="p-4 text-amber-300 bg-amber-900/20 border-t border-amber-700/30">
                        <div className="flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          <span className="font-medium">Cannot display diff:</span>
                          <span className="ml-1">This appears to be a binary file or has encoding issues</span>
                        </div>
                      </div>
                    ) : (
                      /* GitHub-like diff display for text files */
                      <div className="diff-container bg-surface-900">
                        {parseDiffToSideBySide(file.diff).map((diffBlock, blockIdx) => (
                          renderDiffBlock(diffBlock, file.path, blockIdx)
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {/* File content */}
                {file.displayContent && (
                  <div className="p-4 border-t border-surface-700/30 overflow-x-auto">
                    <CodeHighlighter
                      language={getLanguageFromPath(file.path)}
                      customStyle={{ margin: 0, background: 'transparent' }}
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
    </div>
  );
} 