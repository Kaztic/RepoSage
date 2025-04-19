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
          if (prev < 30) {
            // Start slow, then accelerate, then slow down
            const increment = prev < 10 ? 5 : (prev < 20 ? 3 : 1);
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
      // Check if a commit is selected that should be included in context
      const commitHash = selectedCommit ? selectedCommit.hash : undefined;
      
      // Call the API with the selected Gemini model, including commit info if available
      const response = await apiService.sendChatMessageToAI(
        repoUrl, 
        [...messages, userMessage], 
        accessToken || undefined,
        selectedModel,
        'gemini',
        commitHash
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
      // Look for patterns that are likely to be commit hashes
      // This improved regex looks for hash patterns that are:
      // 1. Mentioned as "commit <hash>"
      // 2. Properly formatted hashes of correct length
      // 3. Not part of a diff block (to avoid picking up diff hashes)
      const hashMatches = assistantContent.match(/\b(?:commit:?\s+|hash:?\s+|commit hash:?\s+|sha:?\s+)?([0-9a-f]{7,40})\b/gi);
      
      // Extract just the hashes from the matches
      const potentialHashes = [];
      if (hashMatches) {
        for (const match of hashMatches) {
          // Extract just the hash part
          const hashPart = match.replace(/\b(?:commit:?\s+|hash:?\s+|commit hash:?\s+|sha:?\s+)/i, '');
          if (hashPart.match(/^[0-9a-f]{7,40}$/i)) {
            potentialHashes.push(hashPart);
          }
        }
      }
      
      // Filter to skip hashes within diff blocks
      // Don't process hashes if they appear to be in diff content
      const isDiffContent = assistantContent.includes('```diff') || 
                          assistantContent.includes('+++') || 
                          assistantContent.includes('---') ||
                          assistantContent.match(/^[+-]{1}[^+-]/m);
      
      if (potentialHashes.length > 0 && !isDiffContent) {
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
      const tempMessageId = `lookup-${Date.now()}`;
      const tempMessage: ChatMessage = {
        role: 'assistant',
        content: `Looking up commit ${commitHash}...`,
        timestamp: new Date().toISOString(),
        id: tempMessageId
      };
      setMessages((prev: ChatMessage[]) => [...prev, tempMessage]);
      
      console.log(`Looking up commit hash: ${commitHash} (attempt ${attempt})`);
      
      // Check if we have all the repo info necessary
      if (!repoInfo) {
        // First need to analyze the repository to get basic info
        await fetchRepoStructure();
      }
      
      // Try to normalize the hash format
      let normalizedHash = commitHash;
      
      // Minimum length for a valid Git hash
      const MIN_HASH_LENGTH = 7;
      
      // Handle short hashes - require at least 7 characters for uniqueness
      if (normalizedHash.length < MIN_HASH_LENGTH) {
        console.warn(`Very short commit hash: ${normalizedHash}. A commit hash should be at least ${MIN_HASH_LENGTH} characters.`);
      }
      
      // Validate hash format - accept hex string that meets minimum length requirement
      if (!normalizedHash.match(/^[0-9a-f]+$/i)) {
        // Try to fix common issues with commit hashes
        // Remove any non-hex characters
        const cleanedHash = normalizedHash.replace(/[^0-9a-f]/gi, '');
        
        // If the cleaned hash is valid, use it
        if (cleanedHash.match(/^[0-9a-f]+$/i)) {
          console.log(`Fixed invalid hash format from ${normalizedHash} to ${cleanedHash}`);
          normalizedHash = cleanedHash;
        } else {
          // Remove the temporary message
          setMessages((prev: ChatMessage[]) => prev.filter(m => m.id !== tempMessageId));
          
          // Add error message to chat
          setMessages((prev: ChatMessage[]) => [...prev, {
            role: 'assistant',
            content: `Invalid commit hash format: "${commitHash}"\n\nA commit hash should be a hexadecimal string (containing only 0-9 and a-f characters). Please check the hash and try again.`
          }]);
          
          setLoading(false);
          return;
        }
      }
      
      // Add additional validation for minimum length after cleaning
      if (normalizedHash.length < MIN_HASH_LENGTH) {
        // Remove the temporary message
        setMessages((prev: ChatMessage[]) => prev.filter(m => m.id !== tempMessageId));
        
        // Add error message to chat about minimum length
        setMessages((prev: ChatMessage[]) => [...prev, {
          role: 'assistant',
          content: `The provided hash "${commitHash}" is too short. Git commit hashes should be at least ${MIN_HASH_LENGTH} characters long for uniqueness. Please provide a longer hash.`
        }]);
        
        setLoading(false);
        return;
      }
      
      const data = await apiService.fetchCommitByHash(
        repoUrl,
        normalizedHash,
        accessToken || undefined
      );
      console.log('Commit lookup response:', data);

      if (data.status === 'success') {
        const commit = data.commit;
        
        // Remove the temporary message
        setMessages((prev: ChatMessage[]) => prev.filter(m => m.id !== tempMessageId));
        
        // *** START: Update commitHistory state with detailed commit ***
        setCommitHistory(prevHistory => {
          const existingIndex = prevHistory.findIndex(c => c.hash === commit.hash);
          if (existingIndex !== -1) {
            // Replace existing basic commit info with detailed info
            const updatedHistory = [...prevHistory];
            updatedHistory[existingIndex] = {
              ...updatedHistory[existingIndex], // Keep any existing UI state if needed
              ...commit // Overwrite with new detailed data
            };
            return updatedHistory;
          } else {
            // Add the new detailed commit if not found
            // Ensure file_changes have default UI state if needed
            const detailedCommit = {
              ...commit,
              file_changes: commit.file_changes?.map((fc: any) => ({ 
                ...fc, 
                loading: false, 
                showDiff: false 
              })) || []
            };
            return [...prevHistory, detailedCommit];
          }
        });
        // *** END: Update commitHistory state with detailed commit ***
        
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
        setMessages((prev: ChatMessage[]) => prev.filter(m => m.id !== tempMessageId));
        setMessages((prev: ChatMessage[]) => [...prev, {
          role: 'assistant',
          content: `The commit lookup is taking longer than expected. Retrying... (${attempt}/3)`
        }]);
        
        // Wait a bit before retrying
        setTimeout(() => {
          lookupCommitByHash(commitHash, attempt + 1);
        }, 2000);
      } else if (data.status === 'error' && (
          data.message.includes('not found') || 
          data.message.includes('object not found') ||
          data.message.includes('clone depth')
        )) {
        // Try direct GitHub API as a fallback for commits not found in the local repo
        setMessages((prev: ChatMessage[]) => prev.filter(m => m.id !== tempMessageId));
        setMessages((prev: ChatMessage[]) => [...prev, {
          role: 'assistant',
          content: `Commit not found in local repository. Trying direct GitHub API lookup...`
        }]);
        
        try {
          // Try to fetch directly from GitHub
          const githubData = await apiService.fetchGitHubCommit(
            repoUrl, 
            normalizedHash,
            accessToken || undefined
          );
          
          if (githubData.status === 'success') {
            const commit = githubData.commit;
            
            // *** START: Update commitHistory state with detailed commit from GitHub API ***
            setCommitHistory(prevHistory => {
              const existingIndex = prevHistory.findIndex(c => c.hash === commit.hash);
              if (existingIndex !== -1) {
                // Replace existing basic commit info with detailed info
                const updatedHistory = [...prevHistory];
                updatedHistory[existingIndex] = {
                  ...updatedHistory[existingIndex], // Keep existing UI state
                  ...commit // Overwrite with new detailed data
                };
                return updatedHistory;
              } else {
                // Add the new detailed commit if not found
                const detailedCommit = {
                  ...commit,
                  file_changes: commit.file_changes?.map((fc: any) => ({ 
                    ...fc, 
                    loading: false, 
                    showDiff: false 
                  })) || []
                };
                return [...prevHistory, detailedCommit];
              }
            });
            // *** END: Update commitHistory state with detailed commit from GitHub API ***

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
  : 'No file changes found'}

*Note: This commit was retrieved directly from GitHub API and may not be available in the local repository.*`;
            
            // Add commit details to chat
            setMessages((prev: ChatMessage[]) => [...prev, {
              role: 'assistant',
              content: commitDetails
            }]);
            
            // Also show in the commit viewer
            viewCommitDetails(githubData.commit);
            setCommitHashInput('');
            
            // Update URL with commit hash
            const url = new URL(window.location.href);
            url.searchParams.set('commit', githubData.commit.hash);
            window.history.pushState({}, '', url);
            
            // Add a follow-up message
            setMessages((prev: ChatMessage[]) => [...prev, {
              role: 'assistant',
              content: 'Is there anything specific you\'d like to know about this commit? You can ask me to explain the changes or analyze what this commit does.'
            }]);
            
            setLoading(false);
            return;
          }
          
          // If GitHub lookup also fails, show the original error
          setMessages((prev: ChatMessage[]) => [...prev, {
            role: 'assistant',
            content: `GitHub API lookup also failed: ${githubData.message || 'Unknown error'}`
          }]);
        } catch (githubError) {
          console.error('Error in GitHub API fallback:', githubError);
        }
        
        // Show the original error message
        // Add user-friendly error message to chat
        let errorMsg = data.message || 'Unable to locate this commit.';
        let suggestionMsg = '';
        
        if (errorMsg.includes('not found') || errorMsg.includes('object not found')) {
          errorMsg = `Commit not found: ${normalizedHash}\n\nThis commit hash doesn't match any commits in the current repository.`;
          suggestionMsg = `Please verify that:
1. The hash is correct
2. You're looking at the right repository
3. The commit exists in the currently loaded branch
4. If this is a private repository, ensure your GitHub token has the necessary permissions`;
          
          // Add specific suggestion for shallow clone issue
          if (errorMsg.includes('older than the repository clone depth') || errorMsg.includes('shallow clone')) {
            suggestionMsg += `\n5. This commit may be older than the system's clone depth limit (1000 commits). Try using a more recent commit or contact the administrator to increase the clone depth.`;
          }
        } else if (errorMsg.includes('timed out')) {
          errorMsg = `Request timed out while processing commit ${normalizedHash}. This commit might be very large or complex to analyze.`;
          suggestionMsg = `Try:
1. Refreshing the page and trying again
2. Using a shorter (7-character) commit hash
3. Analyzing a different commit`;
        } else if (errorMsg.includes('access') || errorMsg.includes('permission')) {
          errorMsg = `You don't have permission to access commit ${normalizedHash}.`;
          suggestionMsg = `If this is a private repository, please ensure your GitHub token has the necessary permissions. You can update your token in the credentials settings.`;
        } else if (errorMsg.includes('shallow clone') || errorMsg.includes('clone depth')) {
          errorMsg = `Commit ${normalizedHash} could not be found in the current repository clone.`;
          suggestionMsg = `This commit may be too old. The system currently only clones the most recent 1000 commits. Try using a more recent commit or contact the administrator to increase the clone depth limit.`;
        }
        
        setMessages((prev: ChatMessage[]) => [...prev, {
          role: 'assistant',
          content: `${errorMsg}${suggestionMsg ? '\n\n' + suggestionMsg : ''}`
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