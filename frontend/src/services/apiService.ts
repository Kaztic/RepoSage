import axios from 'axios';
import { ChatMessage } from '../types';
import { getCredentials } from '../utils/indexedDb';

// API Base URL from environment variable or default
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Fixed Gemini model - use the standard model name that matches backend
// Available models:
// - models/gemini-2.0-flash (default)
// - models/gemini-2.0-flash-thinking-exp-1219
const GEMINI_MODEL = "models/gemini-2.0-flash";

// Helper function to get credentials
const getStoredCredentials = async () => {
  try {
    return await getCredentials();
  } catch (error) {
    console.error('Error getting stored credentials:', error);
    return { geminiApiKey: '', githubToken: '' };
  }
};

// Get the base URL for API calls, defaulting to the same origin
const getApiBaseUrl = (): string => {
  return process.env.NEXT_PUBLIC_API_URL || '';
};

export const fetchRepoStructure = async (repoUrl: string, accessToken?: string) => {
  const credentials = await getStoredCredentials();
  const token = accessToken || credentials.githubToken || undefined;
  
  const response = await axios.post(`${API_BASE_URL}/api/repo-structure`, {
    repo_url: repoUrl,
    access_token: token,
  });
  return response.data;
};

export const fetchFileContent = async (repoUrl: string, filePath: string, accessToken?: string) => {
  const credentials = await getStoredCredentials();
  const token = accessToken || credentials.githubToken || undefined;
  
  const response = await axios.post(`${API_BASE_URL}/api/file-content`, {
    repo_url: repoUrl,
    file_path: filePath,
    access_token: token,
  });
  return response.data;
};

export const sendChatMessage = async (
  repoUrl: string, 
  messages: ChatMessage[], 
  accessToken?: string
) => {
  const credentials = await getStoredCredentials();
  const token = accessToken || credentials.githubToken || undefined;
  
  const response = await axios.post(`${API_BASE_URL}/api/chat`, {
    repo_url: repoUrl,
    messages,
    access_token: token,
    model_name: GEMINI_MODEL,
    api_key: credentials.geminiApiKey
  });
  return response.data;
};

export const fetchCommitHistory = async (repoUrl: string, accessToken?: string) => {
  const credentials = await getStoredCredentials();
  const token = accessToken || credentials.githubToken || undefined;
  
  const response = await axios.post(`${API_BASE_URL}/api/commits`, {
    repo_url: repoUrl,
    access_token: token,
  });
  return response.data;
};

export const fetchFullCommitHistory = async (repoUrl: string, accessToken?: string) => {
  const credentials = await getStoredCredentials();
  const token = accessToken || credentials.githubToken || undefined;
  
  const response = await axios.post(`${API_BASE_URL}/api/full-commit-history`, {
    repo_url: repoUrl,
    access_token: token,
  });
  return response.data;
};

export const fetchCommitByHash = async (
  repoUrl: string,
  commitHash: string,
  token?: string
): Promise<any> => {
  try {
    const apiBaseUrl = getApiBaseUrl();
    console.log(`[GitHub API] Fetching commit ${commitHash} from repo ${repoUrl}`);
    console.log(`[GitHub API] Token present: ${!!token}`);
    console.log(`[GitHub API] Timestamp: ${new Date().toISOString()}`);
    
    // Attempt fetch with exponential backoff retry
    let retryCount = 0;
    const maxRetries = 3;
    const initialDelay = 1000; // 1 second
    
    const fetchWithRetry = async (): Promise<any> => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/commit-by-hash`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            repo_url: repoUrl,
            commit_hash: commitHash,
            access_token: token,
          }),
          signal: AbortSignal.timeout(240 * 1000), // 4 minute timeout for large commits
        });
        
        console.log(`[GitHub API] Response status: ${response.status}`);
        
        if (response.status === 429) { // Rate limit exceeded
          const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
          console.log(`[GitHub API] Rate limited. Retry-After: ${retryAfter}s`);
          
          if (retryCount < maxRetries) {
            const delay = retryAfter * 1000 || Math.min(2 ** retryCount * initialDelay, 60000);
            retryCount++;
            console.log(`[GitHub API] Retrying after ${delay/1000}s (attempt ${retryCount}/${maxRetries})`);
            
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithRetry();
          }
        }
        
        const data = await response.json();
        
        if (data.diagnostic) {
          console.log('[GitHub API] Diagnostic info:', data.diagnostic);
        }
        
        if (!response.ok) {
          console.warn(`[GitHub API] Error response:`, data);
          
          if (data.error?.includes('API rate limit exceeded') && retryCount < maxRetries) {
            const delay = Math.min(2 ** retryCount * initialDelay, 60000);
            retryCount++;
            console.log(`[GitHub API] Rate limited. Retrying after ${delay/1000}s (attempt ${retryCount}/${maxRetries})`);
            
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithRetry();
          }
          
          // Check for common Git errors
          if (data.error) {
            if (data.error.includes('not found') || data.error.includes('does not exist')) {
              console.error(`[GitHub API] Git object not found: ${commitHash}`);
            } else if (data.error.includes('authentication')) {
              console.error(`[GitHub API] Authentication error for repo ${repoUrl}`);
            } else if (data.error.includes('timeout')) {
              console.error(`[GitHub API] Request timed out for commit ${commitHash}`);
            }
          }
          
          // Return as is - error handling will be in the UI
          return data;
        }
        
        console.log(`[GitHub API] Successfully fetched commit ${commitHash}`);
        return data;
      } catch (err) {
        // Handle network errors with retries
        if (err instanceof Error) {
          console.error(`[GitHub API] Fetch error:`, err.message);
          
          if ((err.name === 'AbortError' || err.message.includes('network') || 
               err.message.includes('failed') || err.message.includes('abort')) && 
              retryCount < maxRetries) {
            const delay = Math.min(2 ** retryCount * initialDelay, 60000);
            retryCount++;
            console.log(`[GitHub API] Network error. Retrying after ${delay/1000}s (attempt ${retryCount}/${maxRetries})`);
            
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithRetry();
          }
        }
        throw err; // Re-throw if can't handle
      }
    };
    
    return await fetchWithRetry();
  } catch (error) {
    console.error('[GitHub API] Error in fetchCommitByHash:', error);
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to fetch commit details',
      error_details: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : null
    };
  }
};

export const fetchFileContentAtCommit = async (
  repoUrl: string,
  commitHash: string,
  filePath: string,
  accessToken?: string
) => {
  const credentials = await getStoredCredentials();
  const token = accessToken || credentials.githubToken || undefined;
  
  const response = await axios.post(`${API_BASE_URL}/api/file-content-at-commit`, {
    repo_url: repoUrl,
    commit_hash: commitHash,
    file_path: filePath,
    access_token: token,
  });
  return response.data;
};

export const fetchFileDiff = async (
  repoUrl: string,
  commitHash: string,
  filePath: string,
  accessToken?: string
) => {
  const credentials = await getStoredCredentials();
  const token = accessToken || credentials.githubToken || undefined;
  
  const response = await axios.post(`${API_BASE_URL}/api/file-diff`, {
    repo_url: repoUrl,
    commit_hash: commitHash,
    file_path: filePath,
    access_token: token,
  });
  return response.data;
};

/**
 * Send a chat message to the appropriate AI model (Claude or Gemini)
 */
export const sendChatMessageToAI = async (
  repoUrl: string,
  messages: ChatMessage[],
  accessToken?: string,
  modelName: string = "models/gemini-2.0-flash",
  modelProvider: string = "gemini"
) => {
  // Use the debug endpoint for Gemini to diagnose issues
  const endpoint = modelProvider === 'claude' 
    ? `${API_BASE_URL}/api/chat/claude` 
    : `${API_BASE_URL}/api/chat/debug`;  // Use debug endpoint
    
  try {
    const credentials = await getStoredCredentials();
    const token = accessToken || credentials.githubToken || undefined;
    
    const payload = {
      repo_url: repoUrl,
      messages,
      access_token: token,
      model_name: modelName,
      model_provider: modelProvider,
      api_key: credentials.geminiApiKey,
      // Include API keys for both models
      gemini_api_key: credentials.geminiApiKey
    };
    
    // Log the payload for debugging (hiding sensitive info)
    console.log("Sending payload:", JSON.stringify({
      ...payload,
      access_token: token ? '[HIDDEN]' : undefined,
      api_key: '[HIDDEN]',
      gemini_api_key: '[HIDDEN]'
    }, null, 2));
    
    const response = await axios.post(endpoint, payload);
    
    console.log("Response received:", response.data);
    
    // For the debug endpoint, extract just the response field
    if (endpoint.includes('/debug') && response.data.response) {
      return response.data.response;
    }
    
    return response.data;
  } catch (error) {
    console.error("API call error details:", error);
    throw error;
  }
};

/**
 * Analyze code complexity and metrics
 */
export const analyzeCode = async (
  repoUrl: string,
  filePath: string,
  accessToken?: string
) => {
  const credentials = await getStoredCredentials();
  const token = accessToken || credentials.githubToken || undefined;
  
  const response = await axios.post(`${API_BASE_URL}/api/analyze-code`, {
    repo_url: repoUrl,
    file_path: filePath,
    access_token: token,
    api_key: credentials.geminiApiKey
  });
  return response.data;
};

/**
 * Get code recommendations for a file
 */
export const getCodeRecommendations = async (
  repoUrl: string,
  filePath: string,
  accessToken?: string
) => {
  const credentials = await getStoredCredentials();
  const token = accessToken || credentials.githubToken || undefined;
  
  const response = await axios.post(`${API_BASE_URL}/api/code-recommendations`, {
    repo_url: repoUrl,
    file_path: filePath,
    access_token: token,
    api_key: credentials.geminiApiKey
  });
  return response.data;
};

/**
 * Get detailed analysis of file content
 */
export const analyzeFileContent = async (
  repoUrl: string,
  filePath: string,
  accessToken?: string
) => {
  const credentials = await getStoredCredentials();
  const token = accessToken || credentials.githubToken || undefined;
  
  const response = await axios.post(`${API_BASE_URL}/api/analyze-file`, {
    repo_url: repoUrl,
    file_path: filePath,
    access_token: token,
    api_key: credentials.geminiApiKey
  });
  return response.data;
};

/**
 * Search for code elements like classes, functions, etc.
 */
export const searchCodeElement = async (
  repoUrl: string,
  elementName: string,
  elementType: string = 'any',
  accessToken?: string
) => {
  const credentials = await getStoredCredentials();
  const token = accessToken || credentials.githubToken || undefined;
  
  const response = await axios.post(`${API_BASE_URL}/api/search-code-element`, {
    repo_url: repoUrl,
    element_name: elementName,
    element_type: elementType,
    access_token: token,
    api_key: credentials.geminiApiKey
  });
  return response.data;
};

/**
 * Validate if a repository URL is valid and accessible
 */
export const validateRepository = async (
  repoUrl: string,
  accessToken?: string
) => {
  try {
    const credentials = await getStoredCredentials();
    const token = accessToken || credentials.githubToken || undefined;
    
    const response = await axios.post(`${API_BASE_URL}/api/validate-repo`, {
      repo_url: repoUrl,
      access_token: token
    });
    return response.data;
  } catch (error) {
    console.error("Error validating repository:", error);
    return { valid: false, reason: 'Error connecting to API server.' };
  }
};

export const fetchGitHubCommit = async (
  repoUrl: string,
  commitHash: string,
  token?: string
): Promise<any> => {
  try {
    const apiBaseUrl = getApiBaseUrl();
    console.log(`[GitHub API] Directly fetching commit ${commitHash} from GitHub repo ${repoUrl}`);
    
    const response = await fetch(`${apiBaseUrl}/api/github-commit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        repo_url: repoUrl,
        commit_hash: commitHash,
        access_token: token,
      }),
      signal: AbortSignal.timeout(60 * 1000), // 60 second timeout for GitHub API
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.warn(`[GitHub API] Error response:`, data);
      return data;
    }
    
    console.log(`[GitHub API] Successfully fetched commit ${commitHash} directly from GitHub`);
    return data;
  } catch (error) {
    console.error('[GitHub API] Error in fetchGitHubCommit:', error);
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to fetch commit details from GitHub',
      error_details: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : null
    };
  }
}; 