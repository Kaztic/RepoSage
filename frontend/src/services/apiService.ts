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
  accessToken?: string
) => {
  try {
    const credentials = await getStoredCredentials();
    const token = accessToken || credentials.githubToken || undefined;
    
    // Use a longer timeout for potentially large commits
    const response = await axios.post(
      `${API_BASE_URL}/api/commit-by-hash`, 
      {
        repo_url: repoUrl,
        commit_hash: commitHash,
        access_token: token,
      },
      {
        timeout: 60000, // 60 second timeout for large commits
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching commit by hash:", error);
    
    // Handle timeout errors specifically
    if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
      return {
        status: 'error',
        message: 'Request timed out. This commit might be very large or complex to process.'
      };
    }
    
    // Return structured error
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
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