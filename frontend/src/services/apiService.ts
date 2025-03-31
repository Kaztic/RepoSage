import axios from 'axios';
import { ChatMessage } from '../types';

// API Base URL from environment variable or default
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Fixed Gemini model
const GEMINI_MODEL = "models/gemini-2.0-flash-thinking-exp";

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