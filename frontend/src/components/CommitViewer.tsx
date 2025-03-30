import { FaSpinner } from 'react-icons/fa';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { Commit, DiffBlock } from '../types';

type CommitViewerProps = {
  commit: Commit;
  width: string;
  onCopyToChat: (text: string) => void;
  onAddCommitToChat: (commit: Commit) => void;
  onChatWithCommit: (commit: Commit) => void;
  onFetchFileContent: (commitHash: string, filePath: string) => void;
  onToggleFileDiff: (commitHash: string, filePath: string, fileIndex: number) => void;
  onAddFileToChat: (commitHash: string, file: any) => void;
  onChatAboutFile: (commitHash: string, file: any) => void;
  onAddFileContentToChat: (commitHash: string, filePath: string, content: string) => void;
  parseDiffToSideBySide: (diffText: string) => DiffBlock[];
  renderDiffBlock: (diffBlock: DiffBlock, filePath: string, blockIdx: number) => JSX.Element;
  onResizeStart: (e: React.MouseEvent) => void;
};

export default function CommitViewer({
  commit,
  width,
  onCopyToChat,
  onAddCommitToChat,
  onChatWithCommit,
  onFetchFileContent,
  onToggleFileDiff,
  onAddFileToChat,
  onChatAboutFile,
  onAddFileContentToChat,
  parseDiffToSideBySide,
  renderDiffBlock,
  onResizeStart
}: CommitViewerProps) {
  return (
    <div className="relative">
      <div
        className="h-full overflow-auto border-r border-gray-800"
        style={{ width }}
      >
        <div className="p-4 overflow-y-auto">
          <h3 className="text-lg font-semibold mb-2">{commit.message}</h3>
          <div className="text-sm text-gray-400 mb-4">
            <div>Author: {commit.author}</div>
            <div>Date: {new Date(commit.date).toLocaleString()}</div>
            <div className="flex items-center flex-wrap">
              <span>Commit: {commit.short_hash}</span>
              <button 
                onClick={() => onCopyToChat(commit.short_hash)}
                className="ml-2 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-blue-300"
                title="Copy hash to chat input"
              >
                Copy to Chat
              </button>
              <button 
                onClick={() => onAddCommitToChat(commit)}
                className="ml-2 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-green-300"
                title="Add commit details to chat"
              >
                Add to Chat
              </button>
              <button 
                onClick={() => onChatWithCommit(commit)}
                className="ml-2 px-2 py-1 text-xs bg-purple-800 hover:bg-purple-700 rounded text-white"
                title="Ask AI to analyze this commit"
              >
                Chat with Commit
              </button>
            </div>
          </div>
          
          <h4 className="font-medium mb-2 text-gray-300">Files Changed</h4>
          <div className="space-y-2">
            {commit.file_changes && commit.file_changes.map((file, idx) => (
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
                <div className="flex space-x-2 mt-1 flex-wrap">
                  {file.change_type !== 'deleted' && (
                    <button 
                      onClick={() => onFetchFileContent(commit.short_hash, file.path)}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      View file content
                    </button>
                  )}
                  <button 
                    onClick={() => onToggleFileDiff(commit.short_hash, file.path, idx)}
                    className="text-xs text-purple-400 hover:text-purple-300"
                  >
                    {file.showDiff ? 'Hide diff' : 'View diff'}
                  </button>
                  <button 
                    onClick={() => onAddFileToChat(commit.short_hash, file)}
                    className="text-xs text-green-400 hover:text-green-300"
                  >
                    Add to chat
                  </button>
                  {file.change_type !== 'deleted' && (
                    <button 
                      onClick={() => onChatAboutFile(commit.short_hash, file)}
                      className="text-xs text-orange-400 hover:text-orange-300"
                    >
                      Analyze file changes
                    </button>
                  )}
                </div>
                {file.showDiff && file.diffError && (
                  <div className="mt-2 bg-red-900/20 p-2 rounded text-red-300">
                    {file.diffError}
                    {file.change_type !== 'deleted' && (
                      <div className="mt-1">
                        <button 
                          onClick={() => onFetchFileContent(commit.short_hash, file.path)}
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          View file content instead
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {file.showDiff && file.diff && !file.diffError && (
                  <div className="mt-2 bg-gray-900/50 p-2 rounded overflow-x-auto">
                    {/* Check for special case messages */}
                    {typeof file.diff === 'string' && (file.diff.startsWith("File was") || 
                      file.diff.startsWith("Binary file") ||
                      file.diff.startsWith("Error") ||
                      file.diff === "Loading diff..." ||
                      file.diff === "No changes detected in this file for this commit" ||
                      file.diff === "Binary file or encoding error") ? (
                      <div className="py-2 px-3 bg-gray-800 rounded text-gray-300">
                        {file.diff}
                      </div>
                    ) : (
                      /* Improved diff display with custom renderer */
                      <div className="diff-container">
                        {parseDiffToSideBySide(file.diff).map((diffBlock, blockIdx) => 
                          renderDiffBlock(diffBlock, file.path, blockIdx)
                        )}
                      </div>
                    )}
                  </div>
                )}
                {file.displayContent && (
                  <div className="mt-2 bg-gray-900/50 p-2 rounded overflow-x-auto">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-400">File content at commit {commit.short_hash}</span>
                      <button 
                        onClick={() => onAddFileContentToChat(commit.short_hash, file.path, file.displayContent as string)}
                        className="text-xs text-green-400 hover:text-green-300"
                      >
                        Add to chat
                      </button>
                    </div>
                    <SyntaxHighlighter
                      language={file.path.split('.').pop() || 'text'}
                      style={atomDark}
                      customStyle={{ margin: 0 }}
                    >
                      {file.displayContent}
                    </SyntaxHighlighter>
                  </div>
                )}
              </div>
            ))}
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