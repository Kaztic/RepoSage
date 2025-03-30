import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import axios from 'axios';
import { FaGithub, FaSpinner, FaFolder, FaFolderOpen, FaFile } from 'react-icons/fa';
import { PiPaperPlaneTilt } from 'react-icons/pi';
import { TbBrandGithub } from 'react-icons/tb';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';

// API Base URL from environment variable or default
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Fix Gemini model to only use the best one
const GEMINI_MODEL = "models/gemini-2.0-flash-thinking-exp";

// Types
type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
};

type FileStructure = {
  [key: string]: any;
};

type RelevantFile = {
  path: string;
  content: string;
};

type RepoInfo = {
  name: string;
  description: string;
  branches: string[];
  default_branch: string;
};

export default function Home() {
  // State
  const [repoUrl, setRepoUrl] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentInput, setCurrentInput] = useState('');
  const [fileStructure, setFileStructure] = useState<FileStructure>({});
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [fileContent, setFileContent] = useState<RelevantFile | null>(null);
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [relevantFiles, setRelevantFiles] = useState<string[]>([]);
  const [relevantCommits, setRelevantCommits] = useState<any[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'files' | 'commits'>('files');
  const [commitHistory, setCommitHistory] = useState<any[]>([]);
  const selectionPopupRef = useRef<HTMLDivElement>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStartTime, setAnalysisStartTime] = useState<number | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [commitHashInput, setCommitHashInput] = useState('');
  const [sidebarWidth, setSidebarWidth] = useState('25%');
  const [fileViewerWidth, setFileViewerWidth] = useState('40%');
  const resizingRef = useRef<{ active: boolean; type: 'sidebar' | 'fileviewer'; startX: number; startWidth: string }>({
    active: false,
    type: 'sidebar',
    startX: 0,
    startWidth: ''
  });
  const chatInputRef = useRef<HTMLInputElement>(null);
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Handle clicks outside the selection popup
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (selectionPopupRef.current && !selectionPopupRef.current.contains(event.target as Node)) {
        // Hide the popup when clicking outside
        selectionPopupRef.current.style.display = 'none';
      }
    }

    // Add event listener when component mounts
    document.addEventListener('mousedown', handleClickOutside);
    
    // Clean up the event listener when component unmounts
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Scroll to bottom of chat when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check for commit hash in the URL when component mounts
  useEffect(() => {
    // Get URL query parameters
    const queryParams = new URLSearchParams(window.location.search);
    const hashParam = queryParams.get('commit');
    
    if (hashParam && repoUrl && repoInfo) {
      // If we have a hash parameter and the repo is loaded, look up the commit
      setCommitHashInput(hashParam);
      lookupCommitByHash(hashParam);
    }
  }, [repoUrl, repoInfo]);

  // Fetch repository structure
  const fetchRepoStructure = async () => {
    if (!repoUrl) return;

    try {
      setLoading(true);
      setAnalysisProgress(5);
      setAnalysisStartTime(Date.now());
      
      // Clear any existing polling interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      
      // Start a progress simulation to provide feedback during long operations
      pollingIntervalRef.current = setInterval(() => {
        setAnalysisProgress(prev => {
          // Simulate progress up to 90% (the last 10% will happen on successful completion)
          if (prev < 90) {
            // Start slow, then accelerate, then slow down
            const increment = prev < 30 ? 5 : (prev < 60 ? 3 : 1);
            return prev + increment;
          }
          return prev;
        });
      }, 500);
      
      const response = await axios.post(`${API_BASE_URL}/api/repo-structure`, {
        repo_url: repoUrl,
        access_token: accessToken || undefined,
      });

      if (response.data.status === 'success') {
        // Clear polling interval
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        
        setAnalysisProgress(100);
        setFileStructure(response.data.file_structure);
        setRepoInfo(response.data.repo_info);
        
        // Add welcome message with timing information
        const analysisTime = analysisStartTime ? Math.round((Date.now() - analysisStartTime) / 1000) : 0;
        setMessages([
          {
            role: 'assistant',
            content: `👋 Hello! I'm RepoSage, your GitHub repository assistant. I've analyzed the **${response.data.repo_info.name}** repository in ${analysisTime} seconds.\n\nWhat would you like to know about this project?`,
          },
        ]);
        
        // Reset analysis state
        setAnalysisStartTime(null);
      } else if (response.data.status === 'processing') {
        // Poll again after a short delay
        setTimeout(fetchRepoStructure, 3000);
      }
    } catch (error) {
      console.error('Error fetching repository structure:', error);
      
      // Clear polling interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      
      setAnalysisProgress(0);
      setMessages([
        {
          role: 'assistant',
          content: 'Sorry, I had trouble analyzing that repository. Please check the URL and try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Toggle folder expansion
  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  // Fetch file content
  const fetchFileContent = async (path: string) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/file-content`, {
        repo_url: repoUrl,
        file_path: path,
        access_token: accessToken || undefined,
      });

      if (response.data.status === 'success') {
        setFileContent({
          path: response.data.file_path,
          content: response.data.content,
        });
      }
    } catch (error) {
      console.error('Error fetching file content:', error);
    }
  };

  // Send message to chatbot
  const sendMessage = async () => {
    if (!currentInput.trim() || !repoUrl || loading) return;
    
    // Convert input to lowercase for case-insensitive comparison
    const lowerInput = currentInput.toLowerCase();
    
    // Check if input looks like a commit hash (7+ hex characters)
    const commitHashRegex = /\b[0-9a-f]{7,40}\b/;
    const match = currentInput.match(commitHashRegex);
    
    if (match) {
      // If it looks like a commit hash, ask about it
      const commitHash = match[0];
      const userMessage: ChatMessage = {
        role: 'user',
        content: `${currentInput} What was done in this commit?`,
      };
      
      lookupCommitByHash(commitHash);
      return;
    };

    const userMessage: ChatMessage = {
      role: 'user',
      content: currentInput,
    };

    setMessages((prev: ChatMessage[]) => [...prev, userMessage]);
    setCurrentInput('');
    setLoading(true);
    
    const loadingMessage: ChatMessage = {
      role: 'assistant',
      content: '...',
    };
    setMessages((prev: ChatMessage[]) => [...prev, loadingMessage]);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/chat`, {
        repo_url: repoUrl,
        messages: [...messages, userMessage],
        access_token: accessToken || undefined,
        model_name: GEMINI_MODEL
      });
      
      if (response.data.status === 'success') {
        // Remove the loading message
        setMessages((prev: ChatMessage[]) => prev.filter(m => m !== loadingMessage));
        
        // Add the real response
        setMessages((prev: ChatMessage[]) => [...prev, response.data.message]);
        setRelevantFiles(response.data.relevant_files || []);
        
        // Store relevant commits with details
        if (response.data.relevant_commits && response.data.relevant_commits.length > 0) {
          setCommitHistory(prev => [...prev, ...response.data.relevant_commits]);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Remove the loading message
      setMessages((prev: ChatMessage[]) => prev.filter(m => m !== loadingMessage));
      
      setMessages((prev: ChatMessage[]) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, there was an error processing your request. Please try again.'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

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
                    fileContent?.path === currentPath ? 'bg-blue-900/20' : ''
                  }`}
                  onClick={() => {
                    if (isFolder) {
                      toggleFolder(currentPath);
                    } else {
                      fetchFileContent(currentPath);
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

  // Add a function to view commit details
  const viewCommitDetails = (commit: any) => {
    setSelectedCommit(commit);
    // Hide file content view when viewing commit
    setFileContent(null);
  };

  // Update renderCommitDetails to have better diff view
  const renderCommitDetails = (commit: any) => {
    if (!commit) return null;
    
    return (
      <div className="p-4 overflow-y-auto">
        <h3 className="text-lg font-semibold mb-2">{commit.message}</h3>
        <div className="text-sm text-gray-400 mb-4">
          <div>Author: {commit.author}</div>
          <div>Date: {new Date(commit.date).toLocaleString()}</div>
          <div className="flex items-center">
            <span>Commit: {commit.short_hash}</span>
            <button 
              onClick={() => copyToChat(commit.short_hash)}
              className="ml-2 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-blue-300"
              title="Copy hash to chat input"
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
                  onClick={() => fetchFileContentForCommit(commit.short_hash, file.path)}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  View file content
                </button>
                {file.change_type !== 'added' && file.change_type !== 'deleted' && (
                  <button 
                    onClick={() => toggleFileDiff(commit.short_hash, file.path, idx)}
                    className="text-xs text-purple-400 hover:text-purple-300"
                  >
                    {file.showDiff ? 'Hide diff' : 'View diff'}
                  </button>
                )}
              </div>
              {file.showDiff && file.diff && (
                <div className="mt-2 bg-gray-900/50 p-2 rounded overflow-x-auto">
                  {/* Improved diff display */}
                  <div className="diff-container">
                    {parseDiffToSideBySide(file.diff).map((diffBlock, blockIdx) => (
                      <div key={blockIdx} className="mb-4">
                        {diffBlock.header && (
                          <div className="text-gray-400 font-mono text-xs mb-1">
                            {diffBlock.header}
                          </div>
                        )}
                        <div className="flex flex-row">
                          {/* Left side (removed) */}
                          <div className="w-1/2 pr-2 border-r border-gray-700">
                            <SyntaxHighlighter
                              language={getLanguageFromPath(file.path)}
                              style={atomDark}
                              customStyle={{ margin: 0, padding: '0.5rem', fontSize: '0.8rem', background: 'transparent' }}
                            >
                              {diffBlock.removed.join('\n')}
                            </SyntaxHighlighter>
                          </div>
                          {/* Right side (added) */}
                          <div className="w-1/2 pl-2">
                            <SyntaxHighlighter
                              language={getLanguageFromPath(file.path)}
                              style={atomDark}
                              customStyle={{ margin: 0, padding: '0.5rem', fontSize: '0.8rem', background: 'transparent' }}
                            >
                              {diffBlock.added.join('\n')}
                            </SyntaxHighlighter>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {file.displayContent && (
                <div className="mt-2 bg-gray-900/50 p-2 rounded overflow-x-auto">
                  <SyntaxHighlighter
                    language={getLanguageFromPath(file.path)}
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
    );
  };

  // Toggle file diff visibility
  const toggleFileDiff = (commitHash: string, filePath: string, fileIndex: number) => {
    setSelectedCommit((prev: any) => {
      if (!prev) return prev;
      
      const updatedFileChanges = [...prev.file_changes];
      
      // Toggle showDiff flag
      updatedFileChanges[fileIndex] = {
        ...updatedFileChanges[fileIndex],
        showDiff: !updatedFileChanges[fileIndex].showDiff
      };
      
      // If we're showing the diff but don't have it yet, fetch it
      if (updatedFileChanges[fileIndex].showDiff && !updatedFileChanges[fileIndex].diff) {
        fetchFileDiff(commitHash, filePath, fileIndex);
      }
      
      return {
        ...prev,
        file_changes: updatedFileChanges
      };
    });
  };

  // Fetch file diff for a specific commit and file
  const fetchFileDiff = async (commitHash: string, filePath: string, fileIndex: number) => {
    if (!repoUrl) return;
    
    try {
      setLoading(true);
      
      // For now, use the file-content-at-commit endpoint
      // In the future, we could add a specific diff endpoint
      const response = await axios.post(`${API_BASE_URL}/api/file-content-at-commit`, {
        repo_url: repoUrl,
        commit_hash: commitHash,
        file_path: filePath,
        access_token: accessToken || undefined,
      });

      if (response.data.status === 'success') {
        // Update the commit's file change with the diff
        setSelectedCommit((prev: any) => {
          if (!prev) return prev;
          
          const updatedFileChanges = [...prev.file_changes];
          updatedFileChanges[fileIndex] = {
            ...updatedFileChanges[fileIndex],
            diff: `--- a/${filePath}\n+++ b/${filePath}\n${response.data.content}`
          };
          
          return {
            ...prev,
            file_changes: updatedFileChanges
          };
        });
      }
    } catch (error) {
      console.error('Error fetching file diff:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch complete commit history
  const fetchFullCommitHistory = async () => {
    if (!repoUrl || loadingHistory) return;
    
    try {
      setLoadingHistory(true);
      const response = await axios.post(`${API_BASE_URL}/api/full-commit-history`, {
        repo_url: repoUrl,
        access_token: accessToken || undefined,
      });

      if (response.data.status === 'success') {
        setCommitHistory(response.data.commit_history);
        setShowFullHistory(true);
      }
    } catch (error) {
      console.error('Error fetching full commit history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Basic commit history fetch
  const fetchCommitHistory = async () => {
    if (!repoUrl) return;
    
    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE_URL}/api/commits`, {
        repo_url: repoUrl,
        access_token: accessToken || undefined,
      });

      if (response.data.status === 'success') {
        setCommitHistory(response.data.commit_history);
      }
    } catch (error) {
      console.error('Error fetching commit history:', error);
    } finally {
      setLoading(false);
    }
  };

  // Update tab click handler
  const handleTabClick = (tab: 'files' | 'commits') => {
    setActiveTab(tab);
    if (tab === 'commits' && commitHistory.length === 0) {
      fetchCommitHistory();
    }
  };

  // Render commit history
  const renderCommitHistory = () => {
    if (loading || loadingHistory) {
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
              onClick={fetchFullCommitHistory}
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
        {commitHistory.map((commit, index) => (
          <div 
            key={commit.hash} 
            className="p-3 hover:bg-gray-700/50 rounded cursor-pointer"
            onClick={() => viewCommitDetails(commit)}
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

  // Add function to fetch file content for a specific commit
  const fetchFileContentForCommit = async (commitHash: string, filePath: string) => {
    if (!repoUrl) return;
    
    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE_URL}/api/file-content-at-commit`, {
        repo_url: repoUrl,
        commit_hash: commitHash,
        file_path: filePath,
        access_token: accessToken || undefined,
      });

      if (response.data.status === 'success') {
        // Update the commit's file change with the content
        setSelectedCommit((prev: any) => {
          if (!prev) return prev;
          
          const updatedFileChanges = prev.file_changes.map((file: any) => {
            if (file.path === filePath) {
              return {
                ...file,
                displayContent: response.data.content
              };
            }
            return file;
          });
          
          return {
            ...prev,
            file_changes: updatedFileChanges
          };
        });
      }
    } catch (error) {
      console.error('Error fetching file content at commit:', error);
    } finally {
      setLoading(false);
    }
  };

  // Add a function to look up a commit by hash
  const lookupCommitByHash = async (hash?: string) => {
    const commitHash = hash || commitHashInput.trim();
    if (!repoUrl || !commitHash) return;
    
    try {
      setLoading(true);
      
      // Add a temporary loading message to the chat
      const tempMessage: ChatMessage = {
        role: 'assistant',
        content: `Looking up commit ${commitHash}...`,
        timestamp: new Date().toISOString()
      };
      setMessages((prev: ChatMessage[]) => [...prev, tempMessage]);
      
      const response = await axios.post(`${API_BASE_URL}/api/commit-by-hash`, {
        repo_url: repoUrl,
        commit_hash: commitHash,
        access_token: accessToken || undefined,
      });

      if (response.data.status === 'success') {
        const commit = response.data.commit;
        
        // Remove the temporary message
        setMessages((prev: ChatMessage[]) => prev.filter(m => m !== tempMessage));
        
        // Format commit details for chat
        const commitDetails = `**Commit ${commit.short_hash}**
        
Message: ${commit.message}
Author: ${commit.author}
Date: ${new Date(commit.date).toLocaleString()}
Files changed: ${commit.stats.files_changed}

${commit.file_changes && commit.file_changes.length > 0 
  ? 'Files:\n' + commit.file_changes.map((file: {path: string, change_type: string}) => 
    `- ${file.path} (${file.change_type})`).join('\n')
  : 'No file changes found'}`;
        
        // Add commit details to chat
        setMessages((prev: ChatMessage[]) => [...prev, {
          role: 'assistant',
          content: commitDetails
        }]);
        
        // Also show in the commit viewer
        viewCommitDetails(response.data.commit);
        setCommitHashInput('');
        
        // Update URL with commit hash
        const url = new URL(window.location.href);
        url.searchParams.set('commit', response.data.commit.short_hash);
        window.history.pushState({}, '', url);
      } else {
        // Remove the temporary message
        setMessages((prev: ChatMessage[]) => prev.filter(m => m !== tempMessage));
        
        // Add error message to chat
        setMessages((prev: ChatMessage[]) => [...prev, {
          role: 'assistant',
          content: `Commit not found: ${response.data.message || 'Unknown error'}`
        }]);
      }
    } catch (error) {
      console.error('Error looking up commit by hash:', error);
      
      // Show error in chat
      setMessages((prev: ChatMessage[]) => [...prev.filter(m => m.content !== `Looking up commit ${commitHash}...`), {
        role: 'assistant',
        content: `Error looking up commit: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]);
    } finally {
      setLoading(false);
    }
  };
  
  // Focus chat input after copy operations
  const copyToChat = (textToCopy: string) => {
    setCurrentInput((prev: string) => prev + textToCopy + ' ');
    // Use setTimeout to ensure the state has updated before focusing
    setTimeout(() => {
      chatInputRef.current?.focus();
    }, 0);
  };

  // Resize handlers
  const startResize = (e: React.MouseEvent, type: 'sidebar' | 'fileviewer') => {
    e.preventDefault();
    const startWidth = type === 'sidebar' ? sidebarWidth : fileViewerWidth;
    
    resizingRef.current = {
      active: true,
      type,
      startX: e.clientX,
      startWidth
    };
    
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
  };
  
  const handleResize = (e: MouseEvent) => {
    if (!resizingRef.current.active) return;
    
    const { type, startX, startWidth } = resizingRef.current;
    const delta = e.clientX - startX;
    
    // Convert percentage to pixels, then back to percentage after adjustment
    const parentWidth = document.documentElement.clientWidth;
    const startWidthPx = (parseFloat(startWidth) / 100) * parentWidth;
    
    if (type === 'sidebar') {
      const newWidth = ((startWidthPx + delta) / parentWidth) * 100;
      // Limit sidebar width between 15% and 50%
      const clampedWidth = Math.max(15, Math.min(50, newWidth));
      setSidebarWidth(`${clampedWidth}%`);
    } else {
      const newWidth = ((startWidthPx - delta) / parentWidth) * 100;
      // Limit file viewer width between 20% and 60%
      const clampedWidth = Math.max(20, Math.min(60, newWidth));
      setFileViewerWidth(`${clampedWidth}%`);
    }
  };
  
  const stopResize = () => {
    resizingRef.current.active = false;
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
  };
  
  // Cleanup resize listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleResize);
      document.removeEventListener('mouseup', stopResize);
    };
  }, []);

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
  
  // Function to parse unified diff to side-by-side format
  const parseDiffToSideBySide = (diffText: string) => {
    if (!diffText) return [];
    
    const lines = diffText.split('\n');
    const blocks: {
      header: string | null;
      removed: string[];
      added: string[];
    }[] = [];
    
    let currentBlock = {
      header: null as string | null,
      removed: [] as string[],
      added: [] as string[]
    };
    
    lines.forEach(line => {
      // Handle diff headers
      if (line.startsWith('@@') && line.includes('@@')) {
        // If we have content in the current block, push it and start a new one
        if (currentBlock.removed.length > 0 || currentBlock.added.length > 0) {
          blocks.push({...currentBlock});
          currentBlock = {
            header: null,
            removed: [],
            added: []
          };
        }
        
        currentBlock.header = line;
        return;
      }
      
      // Handle file headers
      if (line.startsWith('---') || line.startsWith('+++')) {
        return; // Skip file headers in the side-by-side view
      }
      
      // Handle content lines
      if (line.startsWith('-')) {
        // Line was removed
        currentBlock.removed.push(line.substring(1));
      } else if (line.startsWith('+')) {
        // Line was added
        currentBlock.added.push(line.substring(1));
      } else {
        // Context line - add to both sides
        currentBlock.removed.push(line.startsWith(' ') ? line.substring(1) : line);
        currentBlock.added.push(line.startsWith(' ') ? line.substring(1) : line);
      }
    });
    
    // Add the last block if it has content
    if (currentBlock.removed.length > 0 || currentBlock.added.length > 0) {
      blocks.push(currentBlock);
    }
    
    return blocks;
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <Head>
        <title>RepoSage - GitHub Repository Assistant</title>
        <meta name="description" content="Chat with your GitHub repositories using AI" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Header */}
      <header className="flex flex-col border-b border-gray-700 bg-gray-800">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center">
            <TbBrandGithub className="text-3xl mr-2" />
            <h1 className="text-xl font-bold">RepoSage</h1>
          </div>
          <div className="flex space-x-2 w-2/3">
            <input
              type="text"
              placeholder="GitHub Repository URL (e.g., https://github.com/user/repo)"
              className="flex-grow p-2 bg-gray-700 rounded border border-gray-600 text-white"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
            />
            <input
              type="password"
              placeholder="GitHub Token (optional for private repos)"
              className="w-1/3 p-2 bg-gray-700 rounded border border-gray-600 text-white"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
            />
            <button
              onClick={(e) => {
                e.preventDefault();
                fetchRepoStructure();
              }}
              disabled={loading || !repoUrl}
              className={`px-4 py-2 rounded font-medium ${
                loading || !repoUrl
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? <FaSpinner className="animate-spin" /> : 'Analyze'}
            </button>
          </div>
        </div>
        
        {/* Progress bar for analysis */}
        {analysisProgress > 0 && analysisProgress < 100 && (
          <div className="w-full h-1 bg-gray-700">
            <div 
              className="h-full bg-blue-500 transition-all duration-300 ease-out"
              style={{ width: `${analysisProgress}%` }}
            />
          </div>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Repository Explorer (GitHub style) */}
        <div 
          className="overflow-y-auto border-r border-gray-700 bg-gray-800 flex flex-col"
          style={{ width: sidebarWidth }}
        >
          {repoInfo ? (
            <>
              <div className="p-4 border-b border-gray-700">
                <h2 className="text-lg font-semibold flex items-center">
                  <FaGithub className="mr-2" />
                  {repoInfo.name}
                </h2>
                <p className="text-sm text-gray-400">{repoInfo.description}</p>
                <div className="mt-2 text-xs bg-gray-700 rounded px-2 py-1 inline-block">
                  {repoInfo.default_branch}
                </div>
              </div>
              
              {/* Navigation tabs */}
              <div className="flex border-b border-gray-700">
                <button 
                  className={`flex-1 py-2 px-4 text-sm font-medium ${
                    activeTab === 'files' ? 'border-b-2 border-blue-500 text-white' : 'text-gray-400 hover:text-white'
                  }`} 
                  onClick={() => handleTabClick('files')}
                >
                  Files
                </button>
                <button 
                  className={`flex-1 py-2 px-4 text-sm font-medium ${
                    activeTab === 'commits' ? 'border-b-2 border-blue-500 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                  onClick={() => handleTabClick('commits')}
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
                          onChange={(e) => setCommitHashInput(e.target.value)}
                          placeholder="Enter commit hash"
                          className="flex-grow py-1 px-2 bg-gray-700 rounded-l border border-gray-600 text-white text-sm"
                        />
                        <button
                          onClick={() => lookupCommitByHash()}
                          disabled={loading || !commitHashInput.trim()}
                          className={`py-1 px-2 rounded-r border border-l-0 border-gray-600 text-sm ${
                            loading || !commitHashInput.trim()
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
        </div>

        {/* Resize handle */}
        <div 
          className="w-1 hover:w-2 bg-gray-700 hover:bg-blue-500 cursor-col-resize transition-colors"
          onMouseDown={(e) => startResize(e, 'sidebar')}
        />

        {/* Chat Area - ChatGPT style */}
        <div className="flex-1 flex flex-col">
          {/* Messages area */}
          <div className="flex-1 overflow-y-auto">
            {messages.length > 0 ? (
              <div className="py-4 px-4 md:px-8 lg:px-16 max-w-4xl mx-auto">
                {messages.map((message, index) => (
                  <div key={index} className={`py-5 ${
                    index > 0 ? 'border-t border-gray-700' : ''
                  }`}>
                    <div className="flex items-start">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-4 ${
                        message.role === 'user' ? 'bg-blue-600' : 'bg-green-600'
                      }`}>
                        {message.role === 'user' ? 'U' : 'AI'}
                      </div>
                      <div className="flex-1">
                        <ReactMarkdown
                          className="prose prose-invert max-w-none"
                          remarkPlugins={[remarkGfm]}
                          components={{
                            code({ node, className, children, ...props }: any) {
                              const match = /language-(\w+)/.exec(className || '');
                              const inline = !className || !match;
                              return !inline && match ? (
                                <SyntaxHighlighter
                                  style={atomDark}
                                  language={match[1]}
                                  PreTag="div"
                                  {...props}
                                >
                                  {String(children).replace(/\n$/, '')}
                                </SyntaxHighlighter>
                              ) : (
                                <code className={className} {...props}>
                                  {children}
                                </code>
                              );
                            },
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <FaGithub className="text-6xl mx-auto mb-4 opacity-30" />
                  <h2 className="text-2xl font-bold mb-2">Welcome to RepoSage</h2>
                  <p className="max-w-md">
                    Your AI-powered assistant for exploring and understanding GitHub repositories.
                    Enter a repository URL to get started.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Chat Input - Fixed at bottom */}
          {repoInfo && (
            <div className="p-4 border-t border-gray-700 bg-gray-800">
              <div className="max-w-4xl mx-auto">
                {/* Chat input */}
                <div className="flex rounded-lg border border-gray-700 bg-gray-700 overflow-hidden">
                  <input
                    type="text"
                    ref={chatInputRef}
                    value={currentInput}
                    onChange={(e) => setCurrentInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Ask about this repository..."
                    className="flex-grow px-4 py-3 bg-transparent border-none text-white focus:outline-none"
                    disabled={loading}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={loading || !currentInput.trim()}
                    className={`px-4 flex items-center justify-center ${
                      loading || !currentInput.trim()
                        ? 'text-gray-500 cursor-not-allowed'
                        : 'text-blue-400 hover:text-blue-300'
                    }`}
                  >
                    {loading ? <FaSpinner className="animate-spin" /> : <PiPaperPlaneTilt className="text-xl" />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Another resize handle (only if file/commit viewer is shown) */}
        {(fileContent || selectedCommit) && (
          <div 
            className="w-1 hover:w-2 bg-gray-700 hover:bg-blue-500 cursor-col-resize transition-colors"
            onMouseDown={(e) => startResize(e, 'fileviewer')}
          />
        )}

        {/* File/Commit Viewer (conditional render) */}
        {(fileContent || selectedCommit) && (
          <div 
            className="border-l border-gray-700 overflow-hidden bg-gray-800 flex flex-col"
            style={{ width: fileViewerWidth }}
          >
            <div className="p-2 border-b border-gray-700 font-mono text-sm flex justify-between items-center">
              <span className="truncate">
                {fileContent ? fileContent.path : (selectedCommit ? `Commit: ${selectedCommit.short_hash}` : '')}
              </span>
              <button
                onClick={() => {
                  setFileContent(null);
                  setSelectedCommit(null);
                }}
                className="text-gray-400 hover:text-white px-2"
              >
                ×
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {fileContent ? (
                <div className="p-4 font-mono text-sm">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-gray-300">File content:</span>
                    <button 
                      onClick={() => copyToChat(fileContent.path)}
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
                      language={fileContent.path.split('.').pop() || 'text'}
                      style={atomDark}
                      showLineNumbers
                      customStyle={{ background: 'transparent', margin: 0 }}
                    >
                      {fileContent.content}
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
                            copyToChat(selection.toString());
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
              ) : selectedCommit ? (
                renderCommitDetails(selectedCommit)
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 