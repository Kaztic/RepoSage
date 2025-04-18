import { useState, useRef, useEffect } from 'react';
import { 
  ChatMessage, 
  FileStructure, 
  RelevantFile, 
  RepoInfo, 
  Commit,
  CodeMetrics,
  FileChange
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
  
  // AI Model state
  const [useClaudeModel, setUseClaudeModel] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>('models/gemini-2.0-flash');
  const [codeMetrics, setCodeMetrics] = useState<CodeMetrics | null>(null);
  
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
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  
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
      setTimeout(() => lookupCommitByHash(hashParam), 0);
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
      
      // Clear previous repository data when analyzing a new repository
      setFileStructure({});
      setCommitHistory([]);
      setSelectedCommit(null);
      setShowFullHistory(false);
      setCodeMetrics(null);
      setRelevantFiles([]);
      setFileContent(null);
      
      // First, validate the repository URL
      const validationResult = await apiService.validateRepository(repoUrl, accessToken || undefined);
      
      // Handle invalid repository URLs
      if (!validationResult.valid) {
        setAnalysisProgress(0);
        setMessages([
          {
            role: 'assistant',
            content: `❌ Error: Invalid repository. ${validationResult.reason || 'The repository could not be found or accessed.'}`,
          },
        ]);
        setLoading(false);
        return;
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
        
        // Automatically load commit history in the background
        // Set a slight delay to ensure repository analysis completes first
        setTimeout(() => {
          fetchCommitHistory();
        }, 500);
        
        // Reset analysis state
        setAnalysisStartTime(null);
      } else if (data.status === 'processing') {
        // Poll again after a short delay
        setTimeout(fetchRepoStructure, 3000);
      } else if (data.status === 'error') {
        // Handle error from backend
        // Clear polling interval
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        
        setAnalysisProgress(0);
        setMessages([
          {
            role: 'assistant',
            content: `❌ Error: ${data.message || 'Unable to analyze repository.'}`,
          },
        ]);
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
  
  // Toggle AI model between available models
  const toggleModel = () => {
    // Since we're only using Gemini models, toggle between the two available models
    if (selectedModel === 'models/gemini-2.0-flash') {
      setSelectedModel('models/gemini-2.0-flash-thinking-exp-1219');
    } else {
      setSelectedModel('models/gemini-2.0-flash');
    }
  };

  // Change the selected AI model
  const changeModel = (modelName: string) => {
    setSelectedModel(modelName);
  };

  // Request code metrics for a file
  const requestCodeMetrics = async (filePath: string) => {
    try {
      setLoading(true);
      const response = await apiService.analyzeCode(repoUrl, filePath, accessToken || undefined);
      if (response.status === 'success') {
        setCodeMetrics(response.complexity_metrics);
        
        // Check if recommendations are already available
        if (response.recommendations_status === 'processing') {
          // Poll for recommendations
          setTimeout(async () => {
            const recResponse = await apiService.getCodeRecommendations(repoUrl, filePath);
            if (recResponse.status === 'success') {
              setCodeMetrics((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  recommendations: recResponse.recommendations
                };
              });
            }
          }, 3000);
        }
      }
    } catch (error) {
      console.error('Error fetching code metrics:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Send message to chatbot
  const sendMessage = async () => {
    if (!currentInput.trim() || loading) return;
    
    const userMessage: ChatMessage = {
      role: 'user',
      content: currentInput,
    };
    
    // Add user message to chat
    setMessages(prev => [...prev, userMessage, { role: 'assistant', content: '...' }]);
    setCurrentInput('');
    setLoading(true);
    
    // Focus chat input field for next message
    if (chatInputRef.current) {
      chatInputRef.current.focus();
    }
    
    try {
      // Call the API with the selected Gemini model
      const response = await apiService.sendChatMessageToAI(
        repoUrl, 
        [...messages, userMessage], 
        accessToken || undefined,
        selectedModel,
        'gemini'
      );
      
      // Extract the assistant's response content
      const assistantContent = response.response || response.message?.content || 'I had trouble processing that request.';

      // Update messages with the response
      setMessages(prev => [
        ...prev.slice(0, prev.length - 1), // Remove loading message
        {
          role: 'assistant',
          content: assistantContent,
        },
      ]);

      // *** START: Check for commit hashes in the response ***
      const potentialHashes = assistantContent.match(/\b[a-f0-9]{7,40}\b/gi);
      if (potentialHashes && potentialHashes.length > 0) {
        console.log('Found potential commit hashes in response:', potentialHashes);
        const knownHashes = new Set(commitHistory.map(c => c.hash));
        const knownShortHashes = new Set(commitHistory.map(c => c.short_hash));
        
        potentialHashes.forEach(hash => {
          // Normalize to full length for comparison if it's short
          const isShort = hash.length < 40;
          
          // Check if this hash (or its short version) is already known
          const alreadyKnown = knownHashes.has(hash) || knownShortHashes.has(hash);
          
          if (!alreadyKnown) {
            console.log(`Commit hash ${hash} not found in local history. Fetching details...`);
            // Call lookupCommitByHash without await, let it run in background
            lookupCommitByHash(hash);
          }
        });
      }
      // *** END: Check for commit hashes in the response ***
      
      // Update relevant files
      if (response.relevant_files) {
        setRelevantFiles(response.relevant_files);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [
        ...prev.slice(0, prev.length - 1), // Remove loading message
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error processing your request. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle tab click for files/commits
  const handleTabClick = (tab: 'files' | 'commits') => {
    setActiveTab(tab);
    if (tab === 'commits') {
      // If there are no commits yet, fetch them and show loading state
      if (commitHistory.length === 0) {
        setLoadingHistory(true);
        fetchCommitHistory();
      }
    }
  };
  
  // Fetch commit history
  const fetchCommitHistory = async () => {
    if (!repoUrl) return;
    
    try {
      // Use loadingHistory instead of the main loading state
      // This will prevent the UI from showing the main loading spinner
      setLoadingHistory(true);
      const data = await apiService.fetchCommitHistory(repoUrl, accessToken || undefined);

      if (data.status === 'success') {
        setCommitHistory(data.commit_history);
      }
    } catch (error) {
      console.error('Error fetching commit history:', error);
    } finally {
      setLoadingHistory(false);
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
          } as FileChange;
          
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
  
  // Toggle file content visibility
  const toggleFileContent = (commitHash: string, filePath: string, fileIndex: number) => {
    setSelectedCommit((prev: Commit | null) => {
      if (!prev) return prev;
      
      const updatedFileChanges = [...prev.file_changes];
      
      // If content is already displayed, hide it; otherwise show it
      if (updatedFileChanges[fileIndex].displayContent) {
        updatedFileChanges[fileIndex] = {
          ...updatedFileChanges[fileIndex],
          displayContent: undefined
        };
      } else {
        // Fetch the content if we don't have it yet
        fetchFileContentAtCommit(commitHash, filePath, fileIndex);
      }
      
      return {
        ...prev,
        file_changes: updatedFileChanges
      };
    });
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
    if (!repoUrl || !commitHash || !filePath) return;
    
    try {
      // Update the selected commit to show loading state
      setSelectedCommit(prev => {
        if (!prev || !prev.file_changes) return prev;
        
        const updatedFileChanges = [...prev.file_changes];
        updatedFileChanges[fileIndex] = {
          ...updatedFileChanges[fileIndex],
          loading: true
        };
        
        return {
          ...prev,
          file_changes: updatedFileChanges
        };
      });
      
      // Use our new API to get the diff
      const response = await apiService.fetchFileDiff(repoUrl, commitHash, filePath, accessToken);
      
      // Update the selected commit with the diff content
      setSelectedCommit(prev => {
        if (!prev || !prev.file_changes) return prev;
        
        const updatedFileChanges = [...prev.file_changes];
        updatedFileChanges[fileIndex] = {
          ...updatedFileChanges[fileIndex],
          diff: response.diff,
          loading: false
        };
        
        return {
          ...prev,
          file_changes: updatedFileChanges
        };
      });
    } catch (error) {
      console.error('Error fetching file diff:', error);
      
      // Update the selected commit to show error state
      setSelectedCommit(prev => {
        if (!prev || !prev.file_changes) return prev;
        
        const updatedFileChanges = [...prev.file_changes];
        updatedFileChanges[fileIndex] = {
          ...updatedFileChanges[fileIndex],
          diff: "Error retrieving diff. Please try again.",
          loading: false
        };
        
        return {
          ...prev,
          file_changes: updatedFileChanges
        };
      });
    }
  };
  
  // Look up a commit by hash
  const lookupCommitByHash = async (hash?: string, attempt: number = 1) => {
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
      
      console.log(`Looking up commit hash: ${commitHash} (attempt ${attempt})`);
      
      // Check if we have all the repo info necessary
      if (!repoInfo) {
        // First need to analyze the repository to get basic info
        await fetchRepoStructure();
      }
      
      const data = await apiService.fetchCommitByHash(
        repoUrl,
        commitHash,
        accessToken || undefined
      );
      console.log('Commit lookup response:', data);

      if (data.status === 'success') {
        const commit = data.commit;
        
        // Remove the temporary message
        setMessages((prev: ChatMessage[]) => prev.filter(m => m !== tempMessage));
        
        // Format commit details for chat
        const fileNote = commit.stats.note ? `\n\n*Note: ${commit.stats.note}*` : '';
        const commitDetails = `**Commit ${commit.short_hash}** (${commit.hash})
        
Message: ${commit.message}
Author: ${commit.author}
Date: ${new Date(commit.date).toLocaleString()}
Files changed: ${commit.stats.files_changed}${fileNote}

${commit.file_changes && commit.file_changes.length > 0 
  ? 'Files:\n' + commit.file_changes.slice(0, 15).map((file: {path: string, change_type: string}) => 
    `- ${file.path} (${file.change_type})`).join('\n') + 
    (commit.file_changes.length > 15 ? `\n\n*...and ${commit.file_changes.length - 15} more files*` : '')
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
        url.searchParams.set('commit', data.commit.hash);
        window.history.pushState({}, '', url);

        // Add a follow-up message to guide the user
        setMessages((prev: ChatMessage[]) => [...prev, {
          role: 'assistant',
          content: 'Is there anything specific you\'d like to know about this commit? You can ask me to explain the changes or analyze what this commit does.'
        }]);
      } else if (data.message && data.message.includes("timed out") && attempt < 3) {
        // Handle timeout by trying again with a retry
        setMessages((prev: ChatMessage[]) => prev.filter(m => m !== tempMessage));
        setMessages((prev: ChatMessage[]) => [...prev, {
          role: 'assistant',
          content: `The commit lookup is taking longer than expected. Retrying... (${attempt}/3)`
        }]);
        
        // Wait a bit before retrying
        setTimeout(() => {
          lookupCommitByHash(commitHash, attempt + 1);
        }, 2000);
      } else {
        // Remove the temporary message
        setMessages((prev: ChatMessage[]) => prev.filter(m => m !== tempMessage));
        
        // Add error message to chat
        setMessages((prev: ChatMessage[]) => [...prev, {
          role: 'assistant',
          content: `Commit not found: ${data.message || 'The provided commit hash does not match any commits in this repository. Please check the hash and try again.'}`
        }]);
      }
    } catch (error) {
      console.error('Error looking up commit by hash:', error);
      
      // If it's a network error and we haven't tried too many times yet, retry
      if (error instanceof Error && error.message.includes('network') && attempt < 3) {
        setMessages((prev: ChatMessage[]) => prev.filter(m => 
          m.content !== `Looking up commit ${commitHash}...`
        ));
        
        setMessages((prev: ChatMessage[]) => [...prev, {
          role: 'assistant',
          content: `Network error while looking up commit. Retrying... (${attempt}/3)`
        }]);
        
        // Wait a bit before retrying
        setTimeout(() => {
          lookupCommitByHash(commitHash, attempt + 1);
        }, 2000);
        return;
      }
      
      // Show error in chat
      setMessages((prev: ChatMessage[]) => {
        // Filter out the temporary loading message
        const filteredMessages = prev.filter(m => 
          m.content !== `Looking up commit ${commitHash}...`
        );
        
        // Add error message
        return [...filteredMessages, {
          role: 'assistant',
          content: `Error looking up commit: ${error instanceof Error 
            ? (error.message.includes("timeout") 
               ? "The request timed out. This commit might be very large. Try a different commit." 
               : error.message)
            : 'There was a problem retrieving the commit information. Please try again.'}`
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
    sidebarRef,
    
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
    toggleFileContent,
    toggleFileDiff,
    lookupCommitByHash,
    copyToChat,
    clearChatHistory,
    
    // AI Model state
    useClaudeModel,
    selectedModel,
    codeMetrics,
    toggleModel,
    changeModel,
    requestCodeMetrics,
  };
} 