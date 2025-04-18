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
      <ul className="pl-3">
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
              <li key={currentPath} className={`py-0.5 text-sm ${isRelevant ? 'bg-primary-900/30 rounded' : ''}`}>
                <div
                  className={`flex items-center cursor-pointer rounded px-2 py-1.5 transition-colors
                    ${isRelevant 
                      ? 'text-primary-300 font-medium hover:bg-primary-800/20' 
                      : 'text-surface-200 hover:bg-surface-700/40'}`}
                  onClick={() => {
                    if (isFolder) {
                      onToggleFolder(currentPath);
                    } else {
                      onFetchFileContent(currentPath);
                    }
                  }}
                >
                  <span className={`mr-2 ${isFolder ? (isRelevant ? 'text-primary-400' : 'text-surface-400') : (isRelevant ? 'text-primary-400' : 'text-surface-500')}`}>
                    {isFolder ? (isExpanded ? <FaFolderOpen /> : <FaFolder />) : <FaFile />}
                  </span>
                  <span className="truncate">{key}</span>
                </div>
                {isFolder && isExpanded && (
                  <div className="mt-1 border-l border-surface-700 ml-3">
                    {renderFileStructure(value, currentPath)}
                  </div>
                )}
              </li>
            );
          })}
      </ul>
    );
  };

  // Render commit history
  const renderCommitHistory = () => {
    if (loadingHistory && commitHistory.length === 0) {
      return (
        <div className="flex justify-center items-center p-8 text-surface-300">
          <FaSpinner className="animate-spin text-2xl" />
          <span className="ml-2">Loading commit history...</span>
        </div>
      );
    }

    if (commitHistory.length === 0) {
      return (
        <div className="text-center p-8 text-surface-400">
          <p>No commit history available</p>
        </div>
      );
    }

    return (
      <div className="space-y-1.5 p-2">
        {!showFullHistory && commitHistory.length > 0 && (
          <div className="flex justify-center mb-4">
            <button
              onClick={onFetchFullHistory}
              className="px-3 py-1.5 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-md shadow-sm transition-colors duration-200"
              disabled={loadingHistory}
            >
              {loadingHistory ? (
                <>
                  <FaSpinner className="animate-spin inline mr-1" />
                  Loading...
                </>
              ) : (
                "Load Complete History"
              )}
            </button>
          </div>
        )}
        
        {/* Show loading indicator at the top when loading more commits */}
        {loadingHistory && commitHistory.length > 0 && (
          <div className="flex items-center justify-center py-2 text-sm text-primary-400">
            <FaSpinner className="animate-spin mr-2" />
            <span>Loading commit history...</span>
          </div>
        )}
        
        {commitHistory.map((commit) => (
          <div 
            key={commit.hash} 
            className="p-3 bg-surface-800/80 hover:bg-surface-700/50 rounded-lg border border-surface-700/50 cursor-pointer transition-colors duration-150 shadow-subtle"
            onClick={() => onViewCommitDetails(commit)}
          >
            <div className="flex items-start">
              <div className="text-primary-400 mr-2 font-mono text-sm">
                {commit.short_hash}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="font-medium text-surface-200 truncate">{commit.message.split('\n')[0]}</p>
                <p className="text-xs text-surface-400 mt-1 truncate">
                  {commit.author.split('<')[0]} • {new Date(commit.date).toLocaleDateString()}
                </p>
                <div className="text-xs mt-1 flex items-center">
                  <span className="text-surface-500">{commit.stats.files_changed} files</span>
                  {commit.stats.insertions > 0 && <span className="text-green-400 ml-2">+{commit.stats.insertions}</span>}
                  {commit.stats.deletions > 0 && <span className="text-red-400 ml-2">-{commit.stats.deletions}</span>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Repository Overview Section */}
      <div 
        className="overflow-hidden bg-surface-900 border-b border-surface-700 transition-all duration-200"
        style={{ height: `${overviewHeight}px` }}
      >
        <div className="p-3">
          {repoInfo ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <FaGithub className="text-surface-300 mr-2" />
                  <h2 className="text-lg font-semibold text-surface-100 truncate">
                    {repoInfo.name}
                  </h2>
                </div>
                <div className="text-xs text-surface-400 rounded-full bg-surface-800 px-2 py-0.5 border border-surface-700">
                  {repoInfo.default_branch}
                </div>
              </div>
              <div className="text-sm text-surface-400 mt-2 truncate">
                {repoInfo.full_name}
              </div>
              {repoInfo.description && (
                <div className="text-xs text-surface-300 mt-2 line-clamp-2">
                  {repoInfo.description}
                </div>
              )}
              <div className="flex space-x-2 mt-3 text-xs">
                <div className="bg-surface-800 rounded-md px-2 py-1 text-surface-300 border border-surface-700/50">
                  {repoInfo.stars} stars
                </div>
                <div className="bg-surface-800 rounded-md px-2 py-1 text-surface-300 border border-surface-700/50">
                  {repoInfo.forks} forks
                </div>
                <div className="bg-surface-800 rounded-md px-2 py-1 text-surface-300 border border-surface-700/50">
                  {repoInfo.language}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-surface-400">
              <p>No repository loaded</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Resizer for overview section */}
      <div 
        ref={dragHandleRef}
        className="h-1.5 bg-surface-800 hover:bg-primary-600 cursor-row-resize flex justify-center items-center transition-colors"
        onMouseDown={handleMouseDown}
      >
        <div className="w-10 h-0.5 bg-surface-600 rounded-full"></div>
      </div>
      
      {/* Tabs for Files and Commits */}
      <div className="bg-surface-800 border-b border-surface-700 p-1">
        <div className="flex">
          <button
            className={`flex-1 py-2 px-3 text-sm font-medium rounded transition-colors duration-200
              ${activeTab === 'files' 
                ? 'bg-surface-700 text-white shadow-sm' 
                : 'text-surface-300 hover:bg-surface-700/50 hover:text-surface-200'}`}
            onClick={() => onTabClick('files')}
          >
            Files
          </button>
          <button
            className={`flex-1 py-2 px-3 text-sm font-medium rounded transition-colors duration-200
              ${activeTab === 'commits' 
                ? 'bg-surface-700 text-white shadow-sm' 
                : 'text-surface-300 hover:bg-surface-700/50 hover:text-surface-200'}`}
            onClick={() => onTabClick('commits')}
          >
            Commits
          </button>
        </div>
      </div>
      
      {/* Commit Search (when in commits tab) */}
      {activeTab === 'commits' && (
        <div className="p-2 border-b border-surface-700 bg-surface-800">
          <div className="flex space-x-1">
            <input
              type="text"
              value={commitHashInput}
              onChange={(e) => onCommitHashChange(e.target.value)}
              placeholder="Commit hash"
              className="flex-1 bg-surface-900 border border-surface-700 text-sm px-2 py-1.5 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 text-surface-200 placeholder-surface-500"
            />
            <button
              onClick={onLookupCommit}
              disabled={!commitHashInput.trim() || loadingHistory}
              className={`px-3 py-1.5 rounded-md text-sm font-medium
                ${commitHashInput.trim() && !loadingHistory
                  ? 'bg-primary-600 hover:bg-primary-700 text-white'
                  : 'bg-surface-700 text-surface-400 cursor-not-allowed'}`}
            >
              Find
            </button>
          </div>
        </div>
      )}
      
      {/* File Structure or Commits Content */}
      <div className="flex-1 overflow-y-auto p-2 bg-surface-900/50">
        {activeTab === 'files' ? (
          Object.keys(fileStructure).length > 0 ? (
            renderFileStructure(fileStructure)
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-surface-400 p-4">
              <p>No file structure available</p>
              <p className="text-xs mt-2">Analyze a repository to view files</p>
            </div>
          )
        ) : (
          renderCommitHistory()
        )}
      </div>
    </div>
  );
} 