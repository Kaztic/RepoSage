import { useState, useEffect, useCallback } from 'react';
import { saveCredentials, getCredentials } from '../utils/indexedDb';

export default function useCredentials() {
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');
  const [githubToken, setGithubToken] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  
  // Load credentials from IndexedDB
  const loadCredentials = useCallback(async () => {
    setIsLoading(true);
    
    try {
      const savedCredentials = await getCredentials();
      setGeminiApiKey(savedCredentials?.geminiApiKey || '');
      setGithubToken(savedCredentials?.githubToken || '');
      
      // Show modal if credentials are missing
      if (!savedCredentials?.geminiApiKey || !savedCredentials?.githubToken) {
        setShowCredentialsModal(true);
      }
    } catch (error) {
      console.error('Error loading credentials:', error);
      setShowCredentialsModal(true);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Save credentials to IndexedDB
  const saveUserCredentials = useCallback(async (
    credentials: { geminiApiKey: string; githubToken: string }
  ) => {
    setIsLoading(true);
    
    try {
      await saveCredentials(credentials);
      setGeminiApiKey(credentials.geminiApiKey);
      setGithubToken(credentials.githubToken);
      setShowCredentialsModal(false);
    } catch (error) {
      console.error('Error saving credentials:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Open credentials modal
  const openCredentialsModal = useCallback(() => {
    setShowCredentialsModal(true);
  }, []);
  
  // Close credentials modal
  const closeCredentialsModal = useCallback(() => {
    // Only allow closing if we have credentials
    if (geminiApiKey && githubToken) {
      setShowCredentialsModal(false);
    }
  }, [geminiApiKey, githubToken]);
  
  // Load credentials on initial mount
  useEffect(() => {
    loadCredentials();
  }, [loadCredentials]);
  
  return {
    geminiApiKey,
    githubToken,
    isLoading,
    showCredentialsModal,
    saveCredentials: saveUserCredentials,
    openCredentialsModal,
    closeCredentialsModal
  };
} 