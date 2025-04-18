import { useRef, useEffect, useState } from 'react';
import { FaSpinner, FaCode, FaChartBar } from 'react-icons/fa';
import { PiPaperPlaneTilt } from 'react-icons/pi';
import { TbBrandGithub, TbInfoCircle } from 'react-icons/tb';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { ChatMessage, CodeMetrics } from '../types';

type ChatInterfaceProps = {
  messages: ChatMessage[];
  currentInput: string;
  loading: boolean;
  repoInfoExists: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  chatInputRef: React.RefObject<HTMLTextAreaElement>;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  useClaudeModel?: boolean;
  onToggleModelProvider?: () => void;
  codeMetrics?: CodeMetrics | null;
  onRequestCodeMetrics?: (filePath: string) => void;
  onLookupCommit?: (commitHash: string) => void;
};

export default function ChatInterface({
  messages,
  currentInput,
  loading,
  repoInfoExists,
  messagesEndRef,
  chatInputRef,
  onInputChange,
  onSendMessage,
  selectedModel,
  onModelChange,
  useClaudeModel = false,
  onToggleModelProvider,
  codeMetrics = null,
  onRequestCodeMetrics,
  onLookupCommit
}: ChatInterfaceProps) {
  // Local ref for chat container
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [showMetrics, setShowMetrics] = useState<boolean>(false);
  const [showModelSelect, setShowModelSelect] = useState<boolean>(false);
  
  // Handle manual scrolling
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'end',
        inline: 'nearest'
      });
    }
    
    // Also try direct scrolling to the container's bottom
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };
  
  // Run scroll function when messages change
  useEffect(() => {
    const scrollTimer = setTimeout(scrollToBottom, 150);
    return () => clearTimeout(scrollTimer);
  }, [messages]);
  
  // Enable manual scrolling
  const handleScroll = () => {
    if (chatContainerRef.current) {
      // Check if we're near the bottom
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      
      // Show/hide scroll button based on position
      const scrollButton = document.getElementById('scroll-button');
      if (scrollButton) {
        scrollButton.style.display = isNearBottom ? 'none' : 'flex';
      }
    }
  };
  
  // Add scroll event listener
  useEffect(() => {
    const container = chatContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  // Auto-resize textarea as user types
  useEffect(() => {
    const textarea = chatInputRef.current;
    if (!textarea) return;
    
    const adjustHeight = () => {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 200); // Max height of 200px
      textarea.style.height = `${newHeight}px`;
    };
    
    // Set initial height
    adjustHeight();
    
    // Listen for input events
    textarea.addEventListener('input', adjustHeight);
    return () => textarea.removeEventListener('input', adjustHeight);
  }, [currentInput, chatInputRef]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Shift+Enter adds a new line
    if (e.key === 'Enter' && e.shiftKey) {
      // Allow default behavior (new line)
      return;
    }
    
    // Check if it's a commit hash lookup request
    if (e.key === 'Enter' && currentInput.trim().match(/^[0-9a-f]{7,40}$/i) && repoInfoExists) {
      e.preventDefault();
      
      // The input appears to be a commit hash
      const commitHash = currentInput.trim();
      const tempInput = currentInput;
      
      // Clear the input right away to prevent double submissions
      onInputChange('');
      
      // Add messages to indicate what's happening
      const newMessage: ChatMessage = {
        role: 'user',
        content: `${commitHash} explain what was done in this commit`
      };
      
      // Call the function to look up commit hash
      if (onLookupCommit) {
        onLookupCommit(commitHash);
      }
      
      return;
    }
    
    // Enter or Ctrl+Enter sends the message
    if (e.key === 'Enter' && (!e.shiftKey || e.ctrlKey)) {
      e.preventDefault();
      onSendMessage();
    }
  };

  // Extract file paths from code blocks to enable code metrics analysis
  const extractFilePaths = (content: string) => {
    // Look for markdown code blocks with file paths like ```python:path/to/file.py
    const filePathRegex = /```[\w-]*(?::|(\s+))([^\s\n]+)/g;
    const matches = [];
    let match;
    
    // Use RegExp.exec in a loop instead of matchAll for better compatibility
    while ((match = filePathRegex.exec(content)) !== null) {
      matches.push(match);
    }
    
    return matches.map(match => match[2]).filter(path => path && !path.includes('```'));
  };

  const renderCodeMetricsButton = (content: string) => {
    const filePaths = extractFilePaths(content);
    if (filePaths.length === 0) return null;
    
    return (
      <div className="flex mt-2 space-x-2">
        {filePaths.map((path, idx) => (
          <button
            key={idx}
            onClick={() => onRequestCodeMetrics && onRequestCodeMetrics(path)}
            className="flex items-center text-xs bg-primary-600/20 hover:bg-primary-600/30 rounded px-2 py-1 text-primary-300 transition-colors"
          >
            <FaChartBar className="mr-1" /> Analyze {path.split('/').pop()}
          </button>
        ))}
      </div>
    );
  };

  const renderCodeMetrics = () => {
    if (!codeMetrics || !showMetrics) return null;
    
    return (
      <div className="mt-4 p-4 bg-surface-800 rounded-lg border border-surface-700/50 shadow-subtle">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-medium flex items-center text-surface-100">
            <FaCode className="mr-2 text-primary-400" /> Code Analysis: {codeMetrics.file_path.split('/').pop()}
          </h3>
          <button 
            onClick={() => setShowMetrics(false)}
            className="text-surface-400 hover:text-surface-200 p-1 rounded-full hover:bg-surface-700/50 transition-colors"
          >
            ×
          </button>
        </div>
        
        {codeMetrics.metrics && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-surface-900/70 p-3 rounded-lg border border-surface-700/30">
              <div className="text-surface-400 text-xs">Cyclomatic Complexity</div>
              <div className="text-xl font-semibold text-surface-100">
                {Math.round(codeMetrics.metrics.cyclomatic_complexity * 10) / 10}
                <span className="text-xs ml-1 text-surface-400">
                  {codeMetrics.metrics.cyclomatic_complexity > 10 ? '(High)' : 
                   codeMetrics.metrics.cyclomatic_complexity > 5 ? '(Medium)' : '(Low)'}
                </span>
              </div>
            </div>
            
            <div className="bg-surface-900/70 p-3 rounded-lg border border-surface-700/30">
              <div className="text-surface-400 text-xs">Maintainability</div>
              <div className="text-xl font-semibold text-surface-100">
                {Math.round(codeMetrics.metrics.maintainability_index ?? 0)}
                <span className="text-xs ml-1 text-surface-400">/ 100</span>
              </div>
            </div>
            
            <div className="bg-surface-900/70 p-3 rounded-lg border border-surface-700/30">
              <div className="text-surface-400 text-xs">Lines of Code</div>
              <div className="text-xl font-semibold text-surface-100">
                {codeMetrics.metrics.lines_of_code ?? 'N/A'}
              </div>
            </div>
          </div>
        )}
        
        {codeMetrics.functions && codeMetrics.functions.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium mb-2 text-primary-300">Functions by Complexity</h4>
            <div className="max-h-36 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-surface-400">
                  <tr>
                    <th className="text-left p-2">Name</th>
                    <th className="text-left p-2">Complexity</th>
                    <th className="text-left p-2">Line</th>
                  </tr>
                </thead>
                <tbody>
                  {codeMetrics.functions
                    .sort((a, b) => {
                      const complexityA = typeof a.complexity === 'number' ? a.complexity : 0;
                      const complexityB = typeof b.complexity === 'number' ? b.complexity : 0;
                      return complexityB - complexityA;
                    })
                    .map((func, idx) => {
                      const complexity = typeof func.complexity === 'number' ? func.complexity : 0;
                      return (
                        <tr key={idx} className="border-t border-surface-700/30">
                          <td className="p-2 font-mono text-xs text-surface-200">{func.name}</td>
                          <td className="p-2">
                            <span className={`px-1.5 py-0.5 rounded text-xs ${
                              complexity > 10 ? 'bg-red-900/30 text-red-200' : 
                              complexity > 5 ? 'bg-yellow-900/30 text-yellow-200' : 
                              'bg-green-900/30 text-green-200'
                            }`}>
                              {func.complexity}
                            </span>
                          </td>
                          <td className="p-2 text-surface-400">{func.line}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {codeMetrics.recommendations && (
          <div>
            <h4 className="text-sm font-medium mb-2 text-primary-300">AI Recommendations</h4>
            <div className="bg-surface-900/70 p-3 rounded text-sm border border-surface-700/30">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                className="prose prose-invert prose-sm max-w-none"
              >
                {codeMetrics.recommendations}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full max-h-full">
      {/* Chat messages area */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-4 py-2 bg-surface-900"
        onScroll={handleScroll}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <div className="mb-4">
              <TbBrandGithub className="text-6xl text-primary-400 mx-auto mb-4" />
              <h2 className="text-2xl font-medium mb-2 text-surface-100">Welcome to RepoSage</h2>
              <p className="text-surface-300 max-w-md mx-auto">
                Enter a GitHub repository URL above and click "Analyze" to get started.
                Then ask questions about the repository to explore its contents.
              </p>
            </div>
            <div className="p-4 rounded-lg border border-surface-700 bg-surface-800 mt-4 max-w-md">
              <h3 className="font-medium mb-2 text-primary-300">Example questions:</h3>
              <ul className="space-y-2 text-sm text-left text-surface-200">
                <li className="hover:bg-surface-800/50 p-2 rounded cursor-pointer">
                  • What are the main components of this repository?
                </li>
                <li className="hover:bg-surface-800/50 p-2 rounded cursor-pointer">
                  • Explain the purpose of file X
                </li>
                <li className="hover:bg-surface-800/50 p-2 rounded cursor-pointer">
                  • What's the purpose of function Y in file Z?
                </li>
                <li className="hover:bg-surface-800/50 p-2 rounded cursor-pointer">
                  • List all dependencies
                </li>
              </ul>
            </div>
          </div>
        ) : (
          // Render chat messages
          <div className="space-y-6 pt-4 pb-6 max-w-4xl mx-auto">
            {messages.map((message, index) => (
              <div 
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-[90%] rounded-2xl px-4 py-3 shadow-subtle
                    ${message.role === 'user' 
                      ? 'bg-primary-600 text-white rounded-tr-none'
                      : 'bg-surface-800 text-surface-100 rounded-tl-none border border-surface-700'
                    }`}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    className="prose prose-invert prose-sm sm:prose-base max-w-none break-words"
                    components={{
                      code({node, className, children, ...props}: any) {
                        const match = /language-(\w+)/.exec(className || '');
                        const inline = !className || !match;
                        return !inline && match ? (
                          <div className="overflow-x-auto max-w-full">
                            {/* @ts-ignore - Type issues with SyntaxHighlighter */}
                            <SyntaxHighlighter
                              style={atomDark}
                              language={match[1]}
                              PreTag="div"
                              wrapLines={true}
                              wrapLongLines={true}
                              customStyle={{
                                margin: '0.5rem 0',
                                padding: '1rem',
                                borderRadius: '0.375rem',
                                maxWidth: '100%',
                                overflow: 'auto'
                              }}
                              {...props}
                            >
                              {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                          </div>
                        ) : (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      },
                      // Ensure tables are responsive
                      table({node, ...props}) {
                        return (
                          <div className="overflow-x-auto w-full max-w-full">
                            <table {...props} className="min-w-full" />
                          </div>
                        );
                      },
                      // Ensure images are responsive
                      img({node, ...props}) {
                        return (
                          <img 
                            {...props} 
                            className="max-w-full h-auto" 
                            style={{ maxWidth: '100%' }}
                          />
                        );
                      },
                      // Add additional style for paragraphs
                      p({node, ...props}) {
                        return (
                          <p 
                            {...props} 
                            className="break-words whitespace-pre-wrap mb-3"
                          />
                        );
                      },
                      // Add additional style for list items
                      li({node, ...props}) {
                        return (
                          <li 
                            {...props} 
                            className="break-words mb-1"
                          />
                        );
                      },
                      // Make headings stand out more
                      h1({node, ...props}) {
                        return (
                          <h1 
                            {...props} 
                            className="text-xl font-semibold text-primary-300 mt-4 mb-3"
                          />
                        );
                      },
                      h2({node, ...props}) {
                        return (
                          <h2 
                            {...props} 
                            className="text-lg font-semibold text-primary-300 mt-4 mb-2"
                          />
                        );
                      },
                      h3({node, ...props}) {
                        return (
                          <h3 
                            {...props} 
                            className="text-md font-semibold text-primary-300 mt-3 mb-2"
                          />
                        );
                      }
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>

                  {message.role === 'assistant' && renderCodeMetricsButton(message.content)}
                </div>
              </div>
            ))}
            <div className="h-4" ref={messagesEndRef}></div>
          </div>
        )}
        
        {/* Show code metrics (if available and expanded) */}
        {renderCodeMetrics()}
        
        {/* Scroll to bottom button */}
        <button
          id="scroll-button"
          onClick={scrollToBottom}
          className="hidden fixed bottom-24 right-8 bg-primary-600 hover:bg-primary-700 text-white p-2 rounded-full shadow-elevated transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      </div>
      
      {/* Input area */}
      <div className="p-4 border-t border-surface-700 bg-surface-800">
        <div className="relative max-w-4xl mx-auto">
          <div className="flex items-end rounded-lg shadow-subtle bg-surface-900 border border-surface-700 focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500 transition-all duration-200">
            <textarea
              ref={chatInputRef}
              value={currentInput}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={repoInfoExists ? "Ask a question about the repository..." : "Load a repository first..."}
              disabled={!repoInfoExists}
              className="flex-1 p-3 bg-transparent border-none outline-none text-surface-100 placeholder-surface-500 resize-none overflow-y-auto max-h-32 min-h-[42px]"
              style={{ scrollbarWidth: 'thin' }}
              rows={1}
            />
            <div className="px-3 pb-3 flex items-center space-x-1">
              {selectedModel && (
                <div className="relative">
                  <button
                    onClick={() => setShowModelSelect(!showModelSelect)}
                    className="text-xs px-3 py-1.5 rounded-full bg-primary-600/20 hover:bg-primary-600/30 text-primary-300 mr-2 inline-flex items-center transition-colors"
                  >
                    {selectedModel}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 ml-1">
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                    </svg>
                  </button>
                  
                  {showModelSelect && (
                    <div className="absolute bottom-10 right-0 bg-surface-800 border border-surface-700/60 rounded-lg shadow-elevated p-2 z-10 min-w-[180px]">
                      <div className="text-xs font-medium mb-2 text-primary-300 px-2">Select Model</div>
                      <div className="space-y-0.5">
                        {(useClaudeModel ? ['claude-3-haiku', 'claude-3-sonnet', 'claude-3-opus'] : ['gemini-pro'])
                          .map(model => (
                          <button
                            key={model}
                            onClick={() => {
                              onModelChange(model);
                              setShowModelSelect(false);
                            }}
                            className={`block w-full text-left px-3 py-1.5 text-sm rounded 
                              ${selectedModel === model 
                                ? 'bg-primary-600/20 text-primary-200' 
                                : 'hover:bg-surface-700/50 text-surface-200'}`}
                          >
                            {model}
                          </button>
                        ))}
                      </div>
                      
                      {onToggleModelProvider && (
                        <div className="mt-2 pt-2">
                          <button
                            onClick={() => {
                              onToggleModelProvider();
                              setShowModelSelect(false);
                            }}
                            className="block w-full text-left px-3 py-1.5 text-sm rounded bg-surface-700/30 hover:bg-surface-700/50 text-primary-300 transition-colors"
                          >
                            Switch to {useClaudeModel ? 'Gemini' : 'Claude'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              <button
                onClick={onSendMessage}
                disabled={!repoInfoExists || currentInput.trim() === '' || loading}
                className={`p-2 rounded-full transition-all
                  ${!repoInfoExists || currentInput.trim() === '' || loading 
                    ? 'text-surface-600 cursor-not-allowed' 
                    : 'text-primary-500 hover:text-primary-400 hover:bg-surface-800'
                  }`}
              >
                {loading ? (
                  <FaSpinner className="animate-spin w-5 h-5" />
                ) : (
                  <PiPaperPlaneTilt className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
          <div className="mt-2 text-xs text-surface-500 flex justify-between px-1">
            <span>
              {repoInfoExists ? (
                <>Press <kbd className="px-1 py-0.5 rounded bg-surface-700 text-xs">Enter</kbd> to send, <kbd className="px-1 py-0.5 rounded bg-surface-700 text-xs">Shift+Enter</kbd> for new line</>
              ) : (
                'Enter a repository URL to get started'
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
} 