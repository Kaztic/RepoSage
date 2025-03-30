import { useState } from 'react';
import { FaGithub, FaSpinner, FaFolder, FaFolderOpen, FaFile } from 'react-icons/fa';
import { FileStructure, RepoInfo, Commit } from '../types';

type SidebarProps = {
  repoInfo: RepoInfo | null;
  fileStructure: FileStructure;
  relevantFiles: string[];
  expandedFolders: Set<string>;
  commitHistory: Commit[];
  activeTab: 'files' | 'commits';
  width: string;
  commitHashInput: string;
  loadingHistory: boolean;
  showFullHistory: boolean;
  selectedFilePath: string | null;
  onTabChange: (tab: 'files' | 'commits') => void;
  onToggleFolder: (path: string) => void;
  onFileSelect: (path: string) => void;
  onCommitSelect: (commit: Commit) => void;
  onLoadFullHistory: () => void;
  onCommitHashChange: (hash: string) => void;
  onLookupCommit: () => void;
  onResizeStart: (e: React.MouseEvent) => void;
};

export default function Sidebar({
  repoInfo,
  fileStructure,
  relevantFiles,
  expandedFolders,
  commitHistory,
  activeTab,
  width,
  commitHashInput,
  loadingHistory,
  showFullHistory,
  selectedFilePath,
  onTabChange,
  onToggleFolder,
  onFileSelect,
  onCommitSelect,
  onLoadFullHistory,
  onCommitHashChange,
  onLookupCommit,
  onResizeStart
}: SidebarProps) {
  
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
                  className={`flex items-center cursor-pointer hover:bg-gray-700/30 rounded px-2 py-1 ${
                    selectedFilePath === currentPath ? 'bg-blue-900/20' : ''
                  }`}
                  onClick={() => {
                    if (isFolder) {
                      onToggleFolder(currentPath);
                    } else {
                      onFileSelect(currentPath);
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
              onClick={onLoadFullHistory}
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
            onClick={() => onCommitSelect(commit)}
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
    <div className="relative">
      <div
        className="h-full border-r border-gray-800 overflow-hidden"
        style={{ width }}
      >
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-800">
          <button
            className={`flex-1 px-4 py-2 font-medium text-sm ${
              activeTab === 'files'
                ? 'border-b-2 border-blue-500 text-white'
                : 'text-gray-400 hover:text-gray-300'
            }`}
            onClick={() => onTabChange('files')}
          >
            Files
          </button>
          <button
            className={`flex-1 px-4 py-2 font-medium text-sm ${
              activeTab === 'commits'
                ? 'border-b-2 border-blue-500 text-white'
                : 'text-gray-400 hover:text-gray-300'
            }`}
            onClick={() => onTabChange('commits')}
          >
            Commits
          </button>
        </div>

        {/* Repo Info */}
        {repoInfo && (
          <div className="p-4 border-b border-gray-800">
            <h2 className="font-bold flex items-center">
              <FaGithub className="mr-2" />
              {repoInfo.name}
            </h2>
            <p className="text-gray-400 mt-1">
              {repoInfo.description}
            </p>
            <div className="mt-2">
              <span className="text-gray-400">
                Branch: {repoInfo.default_branch}
              </span>
            </div>
          </div>
        )}
        
        {/* Commit Lookup */}
        {repoInfo && (
          <div className="p-4 border-b border-gray-800">
            <div className="space-y-2">
              <h3 className="font-medium">Find Commit</h3>
              <div className="flex space-x-2">
                <input
                  type="text"
                  className="flex-1 px-3 py-1 bg-gray-800 rounded border border-gray-700 focus:outline-none focus:border-blue-500 text-sm"
                  placeholder="Commit Hash"
                  value={commitHashInput}
                  onChange={(e) => onCommitHashChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onLookupCommit();
                  }}
                />
                <button
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                  onClick={onLookupCommit}
                  disabled={!commitHashInput}
                >
                  Look Up
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Content Area */}
        <div className="overflow-auto">
          {activeTab === 'files' ? (
            <div className="p-2">
              {Object.keys(fileStructure).length > 0 ? (
                renderFileStructure(fileStructure)
              ) : !repoInfo ? (
                <div className="text-center p-8 text-gray-400">
                  <p className="text-center">
                    Enter a GitHub repository URL and click Analyze
                  </p>
                </div>
              ) : (
                <div className="text-center p-8 text-gray-400">
                  <p>No files found</p>
                </div>
              )}
            </div>
          ) : (
            renderCommitHistory()
          )}
        </div>
      </div>
      
      {/* Resize Handle */}
      <div
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-gray-700 hover:bg-blue-500 opacity-50 hover:opacity-100"
        onMouseDown={onResizeStart}
      />
    </div>
  );
} 