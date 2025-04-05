import axios from 'axios';
import { ChatMessage } from '../types';

// API Base URL from environment variable or default
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Fixed Gemini model - use the standard model name that matches backend
// Available models:
// - models/gemini-2.0-flash (default)
// - models/gemini-2.0-flash-thinking-exp-1219
const GEMINI_MODEL = "models/gemini-2.0-flash";

export const fetchRepoStructure = async (repoUrl: string, accessToken?: string) => {
  const response = await axios.post(`${API_BASE_URL}/api/repo-structure`, {
    repo_url: repoUrl,
    access_token: accessToken || undefined,
  });
  return response.data;
};

export const fetchFileContent = async (repoUrl: string, filePath: string, accessToken?: string) => {
  const response = await axios.post(`${API_BASE_URL}/api/file-content`, {
    repo_url: repoUrl,
    file_path: filePath,
    access_token: accessToken || undefined,
  });
  return response.data;
};

export const sendChatMessage = async (
  repoUrl: string, 
  messages: ChatMessage[], 
  accessToken?: string
) => {
  const response = await axios.post(`${API_BASE_URL}/api/chat`, {
    repo_url: repoUrl,
    messages,
    access_token: accessToken || undefined,
    model_name: GEMINI_MODEL
  });
  return response.data;
};

export const fetchCommitHistory = async (repoUrl: string, accessToken?: string) => {
  const response = await axios.post(`${API_BASE_URL}/api/commits`, {
    repo_url: repoUrl,
    access_token: accessToken || undefined,
  });
  return response.data;
};

export const fetchFullCommitHistory = async (repoUrl: string, accessToken?: string) => {
  const response = await axios.post(`${API_BASE_URL}/api/full-commit-history`, {
    repo_url: repoUrl,
    access_token: accessToken || undefined,
  });
  return response.data;
};

export const fetchCommitByHash = async (
  repoUrl: string, 
  commitHash: string, 
  accessToken?: string
) => {
  const response = await axios.post(`${API_BASE_URL}/api/commit-by-hash`, {
    repo_url: repoUrl,
    commit_hash: commitHash,
    access_token: accessToken || undefined,
  });
  return response.data;
};

export const fetchFileContentAtCommit = async (
  repoUrl: string,
  commitHash: string,
  filePath: string,
  accessToken?: string
) => {
  const response = await axios.post(`${API_BASE_URL}/api/file-content-at-commit`, {
    repo_url: repoUrl,
    commit_hash: commitHash,
    file_path: filePath,
    access_token: accessToken || undefined,
  });
  return response.data;
};

export const fetchFileDiff = async (
  repoUrl: string,
  commitHash: string,
  filePath: string,
  accessToken?: string
) => {
  const response = await axios.post(`${API_BASE_URL}/api/file-diff`, {
    repo_url: repoUrl,
    commit_hash: commitHash,
    file_path: filePath,
    access_token: accessToken || undefined,
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
    const payload = {
      repo_url: repoUrl,
      messages,
      access_token: accessToken || undefined,
      model_name: modelName,
      model_provider: modelProvider
    };
    
    // Log the payload for debugging
    console.log("Sending payload:", JSON.stringify(payload, null, 2));
    
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
  const response = await axios.post(`${API_BASE_URL}/api/analyze-code`, {
    repo_url: repoUrl,
    file_path: filePath,
    access_token: accessToken || undefined,
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
  const response = await axios.post(`${API_BASE_URL}/api/code-recommendations`, {
    repo_url: repoUrl,
    file_path: filePath,
    access_token: accessToken || undefined,
  });
  return response.data;
};

/**
 * Get detailed analysis of a file's content including functions and classes
 */
export const analyzeFileContent = async (
  repoUrl: string,
  filePath: string,
  accessToken?: string
) => {
  const response = await axios.post(`${API_BASE_URL}/api/analyze-file-content`, {
    repo_url: repoUrl,
    file_path: filePath,
    access_token: accessToken || undefined,
  });
  return response.data;
};

/**
 * Search for a specific code element (function, class, method)
 */
export const searchCodeElement = async (
  repoUrl: string,
  elementName: string,
  elementType: string = 'any',
  accessToken?: string
) => {
  const response = await axios.post(`${API_BASE_URL}/api/search-code-element`, {
    repo_url: repoUrl,
    element_name: elementName,
    element_type: elementType,
    access_token: accessToken || undefined,
  });
  return response.data;
}; 