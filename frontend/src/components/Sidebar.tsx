import { useState, useRef, useEffect } from 'react';
import { FaGithub, FaSpinner, FaFolder, FaFolderOpen, FaFile } from 'react-icons/fa';
import { FileStructure, RepoInfo, Commit } from '../types';

type SidebarProps = {
  repoInfo: RepoInfo | null;
  fileStructure: FileStructure;
  expandedFolders: Set<string>;
  relevantFiles: string[];
  commitHistory: Commit[];
  activeTab: 'files' | 'commits';
  loadingHistory: boolean;
  showFullHistory: boolean;
  commitHashInput: string;
  onToggleFolder: (path: string) => void;
  onFetchFileContent: (path: string) => void;
  onTabClick: (tab: 'files' | 'commits') => void;
  onCommitHashChange: (value: string) => void;
  onLookupCommit: () => void;
  onViewCommitDetails: (commit: Commit) => void;
  onFetchFullHistory: () => void;
};

export default function Sidebar({
  repoInfo,
  fileStructure,
  expandedFolders,
  relevantFiles,
  commitHistory,
  activeTab,
  loadingHistory,
  showFullHistory,
  commitHashInput,
  onToggleFolder,
  onFetchFileContent,
  onTabClick,
  onCommitHashChange,
  onLookupCommit,
  onViewCommitDetails,
  onFetchFullHistory
}: SidebarProps) {
  // State to control overview section height
  const [overviewHeight, setOverviewHeight] = useState<number>(120);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  
  // Handle drag events for resizing
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  // Effect to handle mouse move and up events
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        // Get the sidebar element's top position
        const sidebarElement = dragHandleRef.current?.parentElement;
        if (sidebarElement) {
          const sidebarRect = sidebarElement.getBoundingClientRect();
          const newHeight = e.clientY - sidebarRect.top;
          // Set a minimum and maximum height
          if (newHeight >= 60 && newHeight <= 300) {
            setOverviewHeight(newHeight);
          }
        }
      }
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
    };
    
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);
  
  // Recursive function to render file structure
  const renderFileStructure = (structure: any, path: string = '') => {
    return (
      <ul className="pl-4">
        {Object.entries(structure)
          .sort(([keyA], [keyB]) => {
            // Sort folders first, then files
            const isAFolder = typeof structure[keyA] === 'object' && structure[keyA] !== null;
            const isBFolder = typeof structure[keyB] === 'object' && structure[keyB] !== null;
            if (isAFolder && !isBFolder) return -1;
            if (!isAFolder && isBFolder) return 1;
            return keyA.localeCompare(keyB);
          })
          .map(([key, value]) => {
            const currentPath = path ? `${path}/${key}` : key;
            const isFolder = typeof value === 'object' && value !== null;
            const isExpanded = expandedFolders.has(currentPath);
            const isRelevant = relevantFiles.includes(currentPath);

            return (
              <li key={currentPath} className={`py-1 ${isRelevant ? 'bg-yellow-900/20 rounded' : ''}`}>
                <div
                  className="flex items-center cursor-pointer hover:bg-gray-700/30 rounded px-2 py-1"
                  onClick={() => {
                    if (isFolder) {
                      onToggleFolder(currentPath);
                    } else {
                      onFetchFileContent(currentPath);
                    }
                  }}
                >
                  <span className="mr-2 text-gray-400">
                    {isFolder ? (isExpanded ? <FaFolderOpen /> : <FaFolder />) : <FaFile />}
                  </span>
                  <span className={isRelevant ? 'text-yellow-200 font-medium' : ''}>{key}</span>
                </div>
                {isFolder && isExpanded && renderFileStructure(value, currentPath)}
              </li>
            );
          })}
      </ul>
    );
  };

  // Render commit history
  const renderCommitHistory = () => {
    if (loadingHistory) {
      return (
        <div className="flex justify-center items-center p-8">
          <FaSpinner className="animate-spin text-2xl" />
        </div>
      );
    }

    if (commitHistory.length === 0) {
      return (
        <div className="text-center p-8 text-gray-400">
          <p>No commit history available</p>
        </div>
      );
    }

    return (
      <div className="space-y-2 p-2">
        {!showFullHistory && commitHistory.length > 0 && (
          <div className="flex justify-center mb-4">
            <button
              onClick={onFetchFullHistory}
              className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 rounded"
              disabled={loadingHistory}
            >
              {loadingHistory ? (
                <FaSpinner className="animate-spin inline mr-1" />
              ) : null}
              Load Complete History
            </button>
          </div>
        )}
        {commitHistory.map((commit) => (
          <div 
            key={commit.hash} 
            className="p-3 hover:bg-gray-700/50 rounded cursor-pointer"
            onClick={() => onViewCommitDetails(commit)}
          >
            <div className="flex items-start">
              <div className="text-gray-400 mr-2 font-mono text-sm">
                {commit.short_hash}
              </div>
              <div className="flex-1">
                <p className="font-medium">{commit.message.split('\n')[0]}</p>
                <p className="text-sm text-gray-400">
                  {commit.author.split('<')[0]} • {new Date(commit.date).toLocaleDateString()}
                </p>
                <div className="text-xs text-gray-500 mt-1">
                  {commit.stats.files_changed} files changed
                  {commit.stats.insertions > 0 && <span className="text-green-400 ml-1">+{commit.stats.insertions}</span>}
                  {commit.stats.deletions > 0 && <span className="text-red-400 ml-1">-{commit.stats.deletions}</span>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      {repoInfo ? (
        <>
          <div 
            className="p-4 border-b border-gray-700 overflow-y-auto" 
            style={{ height: `${overviewHeight}px` }}
          >
            <h2 className="text-lg font-semibold flex items-center">
              <FaGithub className="mr-2" />
              {repoInfo.name}
            </h2>
            <p className="text-sm text-gray-400">{repoInfo.description}</p>
            <div className="mt-2 text-xs bg-gray-700 rounded px-2 py-1 inline-block">
              {repoInfo.default_branch}
            </div>
          </div>
          
          {/* Resizable handle */}
          <div 
            ref={dragHandleRef}
            className="h-1 bg-gray-700 hover:bg-blue-500 cursor-ns-resize flex items-center justify-center"
            onMouseDown={handleMouseDown}
          >
            <div className="w-8 h-1 rounded-full bg-gray-600"></div>
          </div>
          
          {/* Navigation tabs */}
          <div className="flex border-b border-gray-700">
            <button 
              className={`flex-1 py-2 px-4 text-sm font-medium ${
                activeTab === 'files' ? 'border-b-2 border-blue-500 text-white' : 'text-gray-400 hover:text-white'
              }`} 
              onClick={() => onTabClick('files')}
            >
              Files
            </button>
            <button 
              className={`flex-1 py-2 px-4 text-sm font-medium ${
                activeTab === 'commits' ? 'border-b-2 border-blue-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => onTabClick('commits')}
            >
              Commits
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2">
            {activeTab === 'files' ? (
              <>
                <h3 className="font-medium px-2 py-1 text-gray-300 text-sm">Repository Files</h3>
                {Object.keys(fileStructure).length > 0 ? (
                  renderFileStructure(fileStructure)
                ) : (
                  <p className="text-gray-400 text-sm px-2">No files found.</p>
                )}
              </>
            ) : (
              <>
                <div className="mb-2 px-2">
                  <h3 className="font-medium py-1 text-gray-300 text-sm">Find Commit</h3>
                  <div className="flex items-center">
                    <input
                      type="text"
                      value={commitHashInput}
                      onChange={(e) => onCommitHashChange(e.target.value)}
                      placeholder="Enter commit hash"
                      className="flex-grow py-1 px-2 bg-gray-700 rounded-l border border-gray-600 text-white text-sm"
                    />
                    <button
                      onClick={onLookupCommit}
                      disabled={!commitHashInput.trim()}
                      className={`py-1 px-2 rounded-r border border-l-0 border-gray-600 text-sm ${
                        !commitHashInput.trim()
                          ? 'bg-gray-600 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      Go
                    </button>
                  </div>
                </div>
                <h3 className="font-medium px-2 py-1 text-gray-300 text-sm">Commit History</h3>
                {renderCommitHistory()}
              </>
            )}
          </div>
        </>
      ) : (
        <div className="text-center text-gray-400 mt-8">
          <FaGithub className="text-4xl mx-auto mb-4 opacity-50" />
          <p>Enter a GitHub repository URL and click "Analyze" to start</p>
        </div>
      )}
    </>
  );
} 