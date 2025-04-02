import Head from 'next/head';
import { useState } from 'react';
import Layout from '../components/Layout';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import ChatInterface from '../components/ChatInterface';
import FileViewer from '../components/FileViewer';
import CommitViewer from '../components/CommitViewer';
import MainLayout from '../components/MainLayout';
import useRepositoryState from '../hooks/useRepositoryState';

export default function Home() {
  // Use our custom hook to manage all repository state
  const repoState = useRepositoryState();
  
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
            onLookupCommit={() => repoState.lookupCommitByHash()}
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
          />
        }
        rightPanelContent={getRightPanelContent()}
      />
    </Layout>
  );
} 