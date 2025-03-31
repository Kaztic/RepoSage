import { useState, useRef, useEffect } from 'react';
import { 
  ChatMessage, 
  FileStructure, 
  RelevantFile, 
  RepoInfo, 
  Commit 
} from '../types';
import * as apiService from '../services/apiService';

export default function useRepositoryState() {
  // Repository state
  const [repoUrl, setRepoUrl] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [fileStructure, setFileStructure] = useState<FileStructure>({});
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  
  // Chat and content state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [fileContent, setFileContent] = useState<RelevantFile | null>(null);
  const [relevantFiles, setRelevantFiles] = useState<string[]>([]);
  
  // Commit state
  const [commitHistory, setCommitHistory] = useState<Commit[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<Commit | null>(null);
  const [activeTab, setActiveTab] = useState<'files' | 'commits'>('files');
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [commitHashInput, setCommitHashInput] = useState('');
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStartTime, setAnalysisStartTime] = useState<number | null>(null);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Load saved messages from localStorage when component mounts
  useEffect(() => {
    if (repoUrl && repoInfo) {
      const savedMessagesKey = `chat_messages_${repoUrl.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const savedMessages = localStorage.getItem(savedMessagesKey);
      
      if (savedMessages) {
        try {
          const parsedMessages = JSON.parse(savedMessages);
          // Only restore if there are messages and we don't already have messages
          if (parsedMessages.length > 0 && messages.length === 0) {
            setMessages(parsedMessages);
          }
        } catch (e) {
          console.error('Error parsing saved messages:', e);
        }
      }
    }
  }, [repoUrl, repoInfo]);
  
  // Save messages to localStorage when they change
  useEffect(() => {
    if (repoUrl && messages.length > 0) {
      const savedMessagesKey = `chat_messages_${repoUrl.replace(/[^a-zA-Z0-9]/g, '_')}`;
      localStorage.setItem(savedMessagesKey, JSON.stringify(messages));
    }
  }, [messages, repoUrl]);
  
  // Scroll to bottom of chat when messages change
  useEffect(() => {
    // Use a small timeout to ensure DOM has updated
    const scrollTimeout = setTimeout(() => {
      if (messagesEndRef.current) {
        try {
          // Force layout recalculation
          document.body.getBoundingClientRect();
          
          // Try to force scroll calculation by accessing layout properties
          const unused = messagesEndRef.current.offsetHeight;
          const unused2 = messagesEndRef.current.getBoundingClientRect();
          
          // Use scrollIntoView with different options for better browser compatibility
          messagesEndRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'end', 
            inline: 'nearest' 
          });
          
          // As fallback, also try direct scrolling to the container's bottom
          const chatContainer = messagesEndRef.current.parentElement;
          if (chatContainer) {
            if (chatContainer.parentElement) {
              chatContainer.parentElement.scrollTop = chatContainer.parentElement.scrollHeight;
            }
            // Also try scrolling the container itself
            chatContainer.scrollTop = chatContainer.scrollHeight;
          }
          
          // Last resort - try to find containers by traversing up
          let parent = messagesEndRef.current.parentElement;
          for (let i = 0; i < 3; i++) {
            if (parent && parent.classList.contains('overflow-y-auto')) {
              parent.scrollTop = parent.scrollHeight;
              break;
            }
            parent = parent?.parentElement || null;
          }
        } catch (e) {
          console.error('Error during scroll:', e);
        }
      }
    }, 200); // Increased timeout to ensure DOM is fully rendered
    
    return () => clearTimeout(scrollTimeout);
  }, [messages]);
  
  // Clean up polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);
  
  // Initialize commit hash from URL params if available
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
          // Simulate progress up to 90% (the last 10% will happen on success)
          if (prev < 90) {
            // Start slow, then accelerate, then slow down
            const increment = prev < 30 ? 5 : (prev < 60 ? 3 : 1);
            return prev + increment;
          }
          return prev;
        });
      }, 500);
      
      const data = await apiService.fetchRepoStructure(repoUrl, accessToken || undefined);

      if (data.status === 'success') {
        // Clear polling interval
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        
        setAnalysisProgress(100);
        setFileStructure(data.file_structure);
        setRepoInfo(data.repo_info);
        
        // Add welcome message with timing information
        const analysisTime = analysisStartTime ? Math.round((Date.now() - analysisStartTime) / 1000) : 0;
        setMessages([
          {
            role: 'assistant',
            content: `👋 Hello! I'm RepoSage, your GitHub repository assistant. I've analyzed the **${data.repo_info.name}** repository in ${analysisTime} seconds.\n\nWhat would you like to know about this project?`,
          },
        ]);
        
        // Reset analysis state
        setAnalysisStartTime(null);
      } else if (data.status === 'processing') {
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
      setLoading(true);
      const data = await apiService.fetchFileContent(repoUrl, path, accessToken || undefined);

      if (data.status === 'success') {
        setFileContent({
          path: data.file_path,
          content: data.content,
        });
      }
    } catch (error) {
      console.error('Error fetching file content:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Send message to chatbot
  const sendMessage = async () => {
    if (!currentInput.trim() || !repoUrl || loading) return;
    
    // Check for direct commit reference patterns:
    // 1. Just a hash: "b82d0fb"
    // 2. Prefixed hash: "Commit b82d0fb"
    const simpleHashRegex = /\b[0-9a-f]{6,40}\b/i;
    const commitPrefixRegex = /\b(?:commit|hash)[\s:]*([0-9a-f]{6,40})\b/i;
    
    let commitHash = null;
    
    // Check for prefixed commit pattern first (more specific)
    const prefixMatch = currentInput.match(commitPrefixRegex);
    if (prefixMatch && prefixMatch[1]) {
      commitHash = prefixMatch[1];
    } else {
      // Fall back to simple hash detection
      const simpleMatch = currentInput.match(simpleHashRegex);
      if (simpleMatch) {
        commitHash = simpleMatch[0];
      }
    }
    
    // Handle commit references, but distinguish between:
    // 1. Just wanting to see commit info
    // 2. Wanting to chat about the commit
    if (commitHash) {
      const isQuestionAboutCommit = 
        currentInput.toLowerCase().includes('what') || 
        currentInput.toLowerCase().includes('why') || 
        currentInput.toLowerCase().includes('how') || 
        currentInput.toLowerCase().includes('explain') ||
        currentInput.toLowerCase().includes('tell me about') ||
        currentInput.toLowerCase().includes('changes');
      
      // First, add the user's message to the chat
      const userMessage: ChatMessage = {
        role: 'user',
        content: currentInput,
      };
      
      setMessages(prev => [...prev, userMessage]);
      setCurrentInput('');
      setLoading(true);
      
      try {
        // First, look up the commit to show its details
        const data = await apiService.fetchCommitByHash(
          repoUrl,
          commitHash,
          accessToken || undefined
        );
        
        if (data.status === 'success') {
          const commit = data.commit;
          
          // Show the commit details in chat
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
          viewCommitDetails(data.commit);
          
          // Update URL with commit hash
          const url = new URL(window.location.href);
          url.searchParams.set('commit', data.commit.short_hash);
          window.history.pushState({}, '', url);
          
          // If it's a question about the commit, send a follow-up question to the AI
          if (isQuestionAboutCommit) {
            const loadingMessage: ChatMessage = {
              role: 'assistant',
              content: 'Analyzing commit...',
            };
            setMessages((prev: ChatMessage[]) => [...prev, loadingMessage]);
            
            // Construct a detailed prompt for the AI
            const detailedPrompt = `Please analyze this commit:
            Hash: ${commit.short_hash}
            Message: ${commit.message}
            Author: ${commit.author}
            Date: ${new Date(commit.date).toLocaleString()}
            Files changed: ${commit.file_changes.map((f: {path: string, change_type: string}) => f.path).join(', ')}
            
            The user is asking: ${currentInput}
            
            Please provide a detailed explanation of what this commit does, what problems it might be fixing, and why these changes were made.`;
            
            const aiPromptMessage: ChatMessage = {
              role: 'user', 
              content: detailedPrompt
            };
            
            // Send to the API but don't show this message in the chat
            try {
              const analysisData = await apiService.sendChatMessage(
                repoUrl,
                [...messages, userMessage, aiPromptMessage],
                accessToken || undefined
              );
              
              // Remove loading message
              setMessages((prev: ChatMessage[]) => prev.filter(m => m !== loadingMessage));
              
              // Add the analysis response
              if (analysisData.status === 'success') {
                setMessages((prev: ChatMessage[]) => [...prev, analysisData.message]);
                
                // Update relevant files if any
                if (analysisData.relevant_files && analysisData.relevant_files.length > 0) {
                  setRelevantFiles(analysisData.relevant_files);
                } else {
                  // If no relevant files provided by AI, use the files from the commit
                  setRelevantFiles(commit.file_changes.map((f: {path: string, change_type: string}) => f.path));
                }
              }
            } catch (error) {
              console.error('Error getting commit analysis:', error);
              setMessages((prev: ChatMessage[]) => [...prev.filter(m => m !== loadingMessage), {
                role: 'assistant',
                content: 'I had trouble analyzing this commit. You can ask me another question about it or view the details in the commit panel.'
              }]);
            }
          }
        } else {
          // Commit not found
          setMessages((prev: ChatMessage[]) => [...prev, {
            role: 'assistant',
            content: `I couldn't find commit "${commitHash}". Please check the hash and try again.`
          }]);
        }
      } catch (error) {
        console.error('Error processing commit reference:', error);
        setMessages((prev: ChatMessage[]) => [...prev, {
          role: 'assistant',
          content: `Sorry, there was an error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]);
      } finally {
        setLoading(false);
      }
      
      return;
    }

    // Regular message handling (not commit-specific)
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
      const data = await apiService.sendChatMessage(
        repoUrl, 
        [...messages, userMessage], 
        accessToken || undefined
      );
      
      if (data.status === 'success') {
        // Remove the loading message
        setMessages((prev: ChatMessage[]) => prev.filter(m => m !== loadingMessage));
        
        // Add the real response
        setMessages((prev: ChatMessage[]) => [...prev, data.message]);
        setRelevantFiles(data.relevant_files || []);
        
        // Store relevant commits with details
        if (data.relevant_commits && data.relevant_commits.length > 0) {
          setCommitHistory(prev => [...prev, ...data.relevant_commits]);
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
  
  // Handle tab click for files/commits
  const handleTabClick = (tab: 'files' | 'commits') => {
    setActiveTab(tab);
    if (tab === 'commits' && commitHistory.length === 0) {
      fetchCommitHistory();
    }
  };
  
  // Fetch commit history
  const fetchCommitHistory = async () => {
    if (!repoUrl) return;
    
    try {
      setLoading(true);
      const data = await apiService.fetchCommitHistory(repoUrl, accessToken || undefined);

      if (data.status === 'success') {
        setCommitHistory(data.commit_history);
      }
    } catch (error) {
      console.error('Error fetching commit history:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch complete commit history
  const fetchFullCommitHistory = async () => {
    if (!repoUrl || loadingHistory) return;
    
    try {
      setLoadingHistory(true);
      const data = await apiService.fetchFullCommitHistory(repoUrl, accessToken || undefined);

      if (data.status === 'success') {
        setCommitHistory(data.commit_history);
        setShowFullHistory(true);
      }
    } catch (error) {
      console.error('Error fetching full commit history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };
  
  // Add function to view commit details
  const viewCommitDetails = (commit: Commit) => {
    setSelectedCommit(commit);
    // Hide file content view when viewing commit
    setFileContent(null);
  };
  
  // Fetch file content for a specific commit
  const fetchFileContentAtCommit = async (commitHash: string, filePath: string, fileIndex: number) => {
    if (!repoUrl) return;
    
    try {
      setLoading(true);
      const data = await apiService.fetchFileContentAtCommit(
        repoUrl, 
        commitHash, 
        filePath, 
        accessToken || undefined
      );

      if (data.status === 'success') {
        // Update the commit's file change with the content
        setSelectedCommit((prev: Commit | null) => {
          if (!prev) return prev;
          
          const updatedFileChanges = [...prev.file_changes];
          updatedFileChanges[fileIndex] = {
            ...updatedFileChanges[fileIndex],
            displayContent: data.content
          };
          
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
  
  // Toggle file diff visibility
  const toggleFileDiff = (commitHash: string, filePath: string, fileIndex: number) => {
    setSelectedCommit((prev: Commit | null) => {
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
      const data = await apiService.fetchFileContentAtCommit(
        repoUrl,
        commitHash,
        filePath,
        accessToken || undefined
      );

      if (data.status === 'success') {
        // Update the commit's file change with the diff
        setSelectedCommit((prev: Commit | null) => {
          if (!prev) return prev;
          
          const updatedFileChanges = [...prev.file_changes];
          updatedFileChanges[fileIndex] = {
            ...updatedFileChanges[fileIndex],
            diff: `--- a/${filePath}\n+++ b/${filePath}\n${data.content}`
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
  
  // Look up a commit by hash
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
      
      const data = await apiService.fetchCommitByHash(
        repoUrl,
        commitHash,
        accessToken || undefined
      );

      if (data.status === 'success') {
        const commit = data.commit;
        
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
        viewCommitDetails(data.commit);
        setCommitHashInput('');
        
        // Update URL with commit hash
        const url = new URL(window.location.href);
        url.searchParams.set('commit', data.commit.short_hash);
        window.history.pushState({}, '', url);

        // Add a follow-up message to guide the user
        setMessages((prev: ChatMessage[]) => [...prev, {
          role: 'assistant',
          content: 'Is there anything specific you\'d like to know about this commit? You can ask me to explain the changes or analyze what this commit does.'
        }]);
      } else {
        // Remove the temporary message
        setMessages((prev: ChatMessage[]) => prev.filter(m => m !== tempMessage));
        
        // Add error message to chat
        setMessages((prev: ChatMessage[]) => [...prev, {
          role: 'assistant',
          content: `Commit not found: ${data.message || 'Unknown error'}`
        }]);
      }
    } catch (error) {
      console.error('Error looking up commit by hash:', error);
      
      // Show error in chat
      setMessages((prev: ChatMessage[]) => {
        // Filter out the temporary loading message
        const filteredMessages = prev.filter(m => 
          m.content !== `Looking up commit ${commitHash}...`
        );
        
        // Add error message
        return [...filteredMessages, {
          role: 'assistant',
          content: `Error looking up commit: ${error instanceof Error ? error.message : 'Unknown error'}`
        }];
      });
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
  
  // Clear chat history for current repository
  const clearChatHistory = () => {
    if (repoUrl) {
      const savedMessagesKey = `chat_messages_${repoUrl.replace(/[^a-zA-Z0-9]/g, '_')}`;
      // Remove from localStorage
      localStorage.removeItem(savedMessagesKey);
      // Reset messages state
      setMessages([]);
    }
  };
  
  return {
    // State
    repoUrl,
    accessToken,
    fileStructure,
    repoInfo,
    expandedFolders,
    messages,
    currentInput,
    fileContent,
    relevantFiles,
    commitHistory,
    selectedCommit,
    activeTab,
    showFullHistory,
    commitHashInput,
    loading,
    loadingHistory,
    analysisProgress,
    
    // Refs
    messagesEndRef,
    chatInputRef,
    
    // Actions
    setRepoUrl,
    setAccessToken,
    setCurrentInput,
    setCommitHashInput,
    setFileContent,
    setSelectedCommit,
    fetchRepoStructure,
    toggleFolder,
    fetchFileContent,
    sendMessage,
    handleTabClick,
    fetchFullCommitHistory,
    viewCommitDetails,
    fetchFileContentAtCommit,
    toggleFileDiff,
    lookupCommitByHash,
    copyToChat,
    clearChatHistory
  };
} 