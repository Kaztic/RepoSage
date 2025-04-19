import Head from 'next/head';
import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import ChatInterface from '../components/ChatInterface';
import FileViewer from '../components/FileViewer';
import CommitViewer from '../components/CommitViewer';
import MainLayout from '../components/MainLayout';
import CredentialsModal from '../components/CredentialsModal';
import InfoModal from '../components/InfoModal';
import useRepositoryState from '../hooks/useRepositoryState';
import useCredentials from '../hooks/useCredentials';

export default function Home() {
  // Use our custom hook to manage all repository state
  const repoState = useRepositoryState();
  
  // Use our custom hook for credentials
  const credentials = useCredentials();
  
  // State for info modal
  const [infoModal, setInfoModal] = useState({ 
    isOpen: false, 
    title: '',
    message: ''
  });
  
  // Sync access token from credentials
  useEffect(() => {
    if (credentials.githubToken) {
      repoState.setAccessToken(credentials.githubToken);
    }
  }, [credentials.githubToken]);
  
  // Handle opening commit search tab
  const handleOpenCommitSearch = () => {
    if (repoState.repoInfo) {
      repoState.handleTabClick('commits');
    } else {
      // Show info modal if repo isn't loaded
      setInfoModal({
        isOpen: true,
        title: 'Repository Not Loaded',
        message: 'Please enter a GitHub repository URL and click "Analyze" first to search for commits.'
      });
    }
  };
  
  // Close info modal
  const closeInfoModal = () => {
    setInfoModal({ ...infoModal, isOpen: false });
  };
  
  // Determine what content to show in the right panel
  const getRightPanelContent = () => {
    if (repoState.fileContent) {
      return (
        <FileViewer 
          file={repoState.fileContent} 
          onCopyToChat={repoState.copyToChat} 
          onClose={() => repoState.setFileContent(null)} 
        />
      );
    } else if (repoState.selectedCommit) {
      return (
        <CommitViewer 
          commit={repoState.selectedCommit} 
          onCopyToChat={repoState.copyToChat} 
          onClose={() => repoState.setSelectedCommit(null)}
          onFetchFileContent={repoState.fetchFileContentAtCommit}
          onToggleFileDiff={repoState.toggleFileDiff} 
          onToggleFileContent={repoState.toggleFileContent}
        />
      );
    }
    return null;
  };

  return (
    <Layout>
      <Head>
        <title>RepoSage - GitHub Repository Assistant</title>
        <meta name="description" content="Chat with your GitHub repositories using AI" />
      </Head>

      {/* Credentials Modal */}
      <CredentialsModal
        isOpen={credentials.showCredentialsModal}
        initialValues={{
          geminiApiKey: credentials.geminiApiKey,
          githubToken: credentials.githubToken
        }}
        onSave={credentials.saveCredentials}
        onClose={credentials.closeCredentialsModal}
      />
      
      {/* Info Modal */}
      <InfoModal 
        isOpen={infoModal.isOpen}
        title={infoModal.title}
        message={infoModal.message}
        onClose={closeInfoModal}
      />

      {/* Header with repository input */}
      <Header 
        repoUrl={repoState.repoUrl}
        accessToken={repoState.accessToken}
        loading={repoState.loading}
        analysisProgress={repoState.analysisProgress}
        onRepoUrlChange={repoState.setRepoUrl}
        onAccessTokenChange={repoState.setAccessToken}
        onAnalyze={repoState.fetchRepoStructure}
        onClearChat={repoState.clearChatHistory}
        onManageCredentials={credentials.openCredentialsModal}
        onOpenCommitSearch={handleOpenCommitSearch}
      />

      {/* Main content with sidebar, chat, and file/commit viewer */}
      <MainLayout
        sidebarContent={
          <Sidebar
            repoInfo={repoState.repoInfo}
            fileStructure={repoState.fileStructure}
            expandedFolders={repoState.expandedFolders}
            relevantFiles={repoState.relevantFiles}
            commitHistory={repoState.commitHistory}
            activeTab={repoState.activeTab}
            loadingHistory={repoState.loadingHistory}
            showFullHistory={repoState.showFullHistory}
            commitHashInput={repoState.commitHashInput}
            onToggleFolder={repoState.toggleFolder}
            onFetchFileContent={repoState.fetchFileContent}
            onTabClick={repoState.handleTabClick}
            onCommitHashChange={repoState.setCommitHashInput}
            onLookupCommit={() => {
              console.log('[Sidebar] Lookup commit triggered with hash:', repoState.commitHashInput);
              repoState.lookupCommitByHash(repoState.commitHashInput);
            }}
            onViewCommitDetails={repoState.viewCommitDetails}
            onFetchFullHistory={repoState.fetchFullCommitHistory}
          />
        }
        mainContent={
          <ChatInterface
            messages={repoState.messages}
            currentInput={repoState.currentInput}
            loading={repoState.loading}
            repoInfoExists={!!repoState.repoInfo}
            messagesEndRef={repoState.messagesEndRef}
            chatInputRef={repoState.chatInputRef}
            onInputChange={repoState.setCurrentInput}
            onSendMessage={repoState.sendMessage}
            selectedModel={repoState.selectedModel}
            onModelChange={repoState.changeModel}
            useClaudeModel={repoState.useClaudeModel}
            onToggleModelProvider={repoState.toggleModel}
            codeMetrics={repoState.codeMetrics}
            onRequestCodeMetrics={repoState.requestCodeMetrics}
            onLookupCommit={repoState.lookupCommitByHash}
          />
        }
        rightPanelContent={getRightPanelContent()}
      />
    </Layout>
  );
} 