import axios from 'axios';
import { ChatMessage } from '../types';

// API Base URL from environment variable or default
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Fix Gemini model to only use the best one
const GEMINI_MODEL = "models/gemini-2.0-flash-thinking-exp";

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const API = {
  // Repository analysis
  fetchRepoStructure: async (repoUrl: string, accessToken?: string) => {
    const response = await apiClient.post('/api/repo-structure', {
      repo_url: repoUrl,
      access_token: accessToken || undefined,
    });
    return response.data;
  },
  
  // File operations
  fetchFileContent: async (repoUrl: string, filePath: string, accessToken?: string) => {
    const response = await apiClient.post('/api/file-content', {
      repo_url: repoUrl,
      file_path: filePath,
      access_token: accessToken || undefined,
    });
    return response.data;
  },
  
  fetchFileContentAtCommit: async (repoUrl: string, commitHash: string, filePath: string, accessToken?: string) => {
    const response = await apiClient.post('/api/file-content-at-commit', {
      repo_url: repoUrl,
      commit_hash: commitHash,
      file_path: filePath,
      access_token: accessToken || undefined,
    });
    return response.data;
  },
  
  fetchFileDiff: async (repoUrl: string, commitHash: string, filePath: string, accessToken?: string) => {
    const response = await apiClient.post('/api/file-diff', {
      repo_url: repoUrl,
      commit_hash: commitHash,
      file_path: filePath,
      access_token: accessToken || undefined,
    });
    return response.data;
  },
  
  // Commit operations
  fetchCommitHistory: async (repoUrl: string, accessToken?: string) => {
    const response = await apiClient.post('/api/commits', {
      repo_url: repoUrl,
      access_token: accessToken || undefined,
    });
    return response.data;
  },
  
  fetchFullCommitHistory: async (repoUrl: string, accessToken?: string) => {
    const response = await apiClient.post('/api/full-commit-history', {
      repo_url: repoUrl,
      access_token: accessToken || undefined,
    });
    return response.data;
  },
  
  fetchCommitByHash: async (repoUrl: string, commitHash: string, accessToken?: string) => {
    const response = await apiClient.post('/api/commit-by-hash', {
      repo_url: repoUrl,
      commit_hash: commitHash,
      access_token: accessToken || undefined,
    });
    return response.data;
  },
  
  // Chat operations
  sendChatMessage: async (repoUrl: string, messages: ChatMessage[], accessToken?: string) => {
    const response = await apiClient.post('/api/chat', {
      repo_url: repoUrl,
      messages,
      access_token: accessToken || undefined,
      model_name: GEMINI_MODEL
    });
    return response.data;
  }
};

export default API; 