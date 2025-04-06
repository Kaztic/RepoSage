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
            className="flex items-center text-xs bg-blue-600/30 hover:bg-blue-600/50 rounded px-2 py-1"
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
      <div className="mt-4 p-4 bg-gray-900 rounded-lg border border-gray-700">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-medium flex items-center">
            <FaCode className="mr-2" /> Code Analysis: {codeMetrics.file_path.split('/').pop()}
          </h3>
          <button 
            onClick={() => setShowMetrics(false)}
            className="text-gray-400 hover:text-white"
          >
            ×
          </button>
        </div>
        
        {codeMetrics.metrics && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-gray-800 p-3 rounded-lg">
              <div className="text-gray-400 text-xs">Cyclomatic Complexity</div>
              <div className="text-xl font-semibold">
                {Math.round(codeMetrics.metrics.cyclomatic_complexity * 10) / 10}
                <span className="text-xs ml-1 text-gray-400">
                  {codeMetrics.metrics.cyclomatic_complexity > 10 ? '(High)' : 
                   codeMetrics.metrics.cyclomatic_complexity > 5 ? '(Medium)' : '(Low)'}
                </span>
              </div>
            </div>
            
            <div className="bg-gray-800 p-3 rounded-lg">
              <div className="text-gray-400 text-xs">Maintainability</div>
              <div className="text-xl font-semibold">
                {Math.round(codeMetrics.metrics.maintainability_index ?? 0)}
                <span className="text-xs ml-1 text-gray-400">/ 100</span>
              </div>
            </div>
            
            <div className="bg-gray-800 p-3 rounded-lg">
              <div className="text-gray-400 text-xs">Lines of Code</div>
              <div className="text-xl font-semibold">
                {codeMetrics.metrics.lines_of_code ?? 'N/A'}
              </div>
            </div>
          </div>
        )}
        
        {codeMetrics.functions && codeMetrics.functions.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium mb-2 text-gray-300">Functions by Complexity</h4>
            <div className="max-h-36 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-400">
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
                        <tr key={idx} className="border-t border-gray-800">
                          <td className="p-2 font-mono text-xs">{func.name}</td>
                          <td className="p-2">
                            <span className={`px-1.5 py-0.5 rounded text-xs ${
                              complexity > 10 ? 'bg-red-900/30 text-red-300' : 
                              complexity > 5 ? 'bg-yellow-900/30 text-yellow-300' : 
                              'bg-green-900/30 text-green-300'
                            }`}>
                              {func.complexity}
                            </span>
                          </td>
                          <td className="p-2 text-gray-400">{func.line}</td>
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
            <h4 className="text-sm font-medium mb-2 text-gray-300">AI Recommendations</h4>
            <div className="bg-gray-800 p-3 rounded text-sm">
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
    <div className="flex-1 flex flex-col h-full max-h-full">
      <div className="border-b border-gray-800 px-4 py-2 flex justify-between items-center">
        <h2 className="text-lg font-semibold">Repository Chat</h2>
        <div className="flex items-center space-x-2">
          <div className="relative">
            {/* Model toggle button */}
            <div 
              onClick={() => setShowModelSelect(!showModelSelect)}
              className="flex items-center bg-gray-800 rounded-full px-2 py-1 text-xs cursor-pointer"
            >
              <span className="mr-1">Model:</span>
              <button 
                className={`rounded-full px-2 py-0.5 transition-colors ${
                  useClaudeModel ? 'bg-purple-600 text-white' : 'bg-blue-600 text-white'
                }`}
              >
                {useClaudeModel 
                  ? (selectedModel === 'claude-3-opus' ? 'Claude Opus' : 
                     selectedModel === 'claude-3-haiku' ? 'Claude Haiku' : 'Claude Sonnet')
                  : (selectedModel === 'models/gemini-2.0-flash' ? 'Gemini 2.0 Flash' : 'Gemini 2.0 Flash Thinking')}
              </button>
              <svg className="w-3 h-3 ml-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            
            {showModelSelect && (
              <div 
                className="absolute right-0 top-8 mt-1 bg-gray-900 border border-gray-700 rounded-lg py-1 shadow-lg z-10 w-48"
                onBlur={() => setShowModelSelect(false)}
              >
                <div className="px-3 py-1 text-xs font-semibold text-gray-400 border-b border-gray-700">
                  Gemini Models
                </div>
                <button 
                  onClick={() => {
                    if (useClaudeModel) onToggleModelProvider && onToggleModelProvider();
                    onModelChange('models/gemini-2.0-flash');
                    setShowModelSelect(false);
                  }}
                  className={`flex items-center w-full px-3 py-2 text-sm hover:bg-gray-800 ${
                    !useClaudeModel && selectedModel === 'models/gemini-2.0-flash' ? 'text-blue-400' : 'text-white'
                  }`}
                >
                  <div className="w-2 h-2 rounded-full mr-2 bg-blue-500"></div>
                  Gemini 2.0 Flash
                </button>
                <button 
                  onClick={() => {
                    if (useClaudeModel) onToggleModelProvider && onToggleModelProvider();
                    onModelChange('models/gemini-2.0-flash-thinking-exp-1219');
                    setShowModelSelect(false);
                  }}
                  className={`flex items-center w-full px-3 py-2 text-sm hover:bg-gray-800 ${
                    !useClaudeModel && selectedModel === 'models/gemini-2.0-flash-thinking-exp-1219' ? 'text-blue-400' : 'text-white'
                  }`}
                >
                  <div className="w-2 h-2 rounded-full mr-2 bg-green-300"></div>
                  Gemini 2.0 Flash Thinking
                </button>
              </div>
            )}
          </div>
          
          <button
            className="text-gray-400 hover:text-white"
            title="About AI Models"
          >
            <TbInfoCircle />
          </button>
        </div>
      </div>
      
      <div 
        ref={chatContainerRef} 
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 scroll-smooth"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <TbBrandGithub className="text-5xl mb-4" />
            <p className="text-xl font-medium">Welcome to RepoSage</p>
            <p className="text-sm mt-2">
              Enter a GitHub repository URL and click Analyze to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-6 max-w-full">
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[90%] md:max-w-3xl rounded-lg p-4 ${
                    message.role === 'user'
                      ? 'bg-blue-600/50 text-white'
                      : 'bg-gray-800 text-gray-100'
                  }`}
                >
                  {message.content === '...' ? (
                    <FaSpinner className="animate-spin" />
                  ) : (
                    <>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        className="prose prose-invert max-w-none break-words overflow-hidden"
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
                                className="break-words whitespace-pre-wrap"
                              />
                            );
                          },
                          // Add additional style for list items
                          li({node, ...props}) {
                            return (
                              <li 
                                {...props} 
                                className="break-words"
                              />
                            );
                          }
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                      
                      {message.role === 'assistant' && renderCodeMetricsButton(message.content)}
                    </>
                  )}
                </div>
              </div>
            ))}
            {codeMetrics && showMetrics && renderCodeMetrics()}
            <div ref={messagesEndRef} className="h-0.5" />
            <button 
              id="scroll-button"
              onClick={scrollToBottom}
              className="fixed bottom-20 right-6 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full shadow-lg z-10 flex items-center justify-center"
              aria-label="Scroll to bottom"
            >
              ↓
            </button>
          </div>
        )}
      </div>
      <div className="border-t border-gray-800 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSendMessage();
          }}
          className="flex space-x-2"
        >
          <textarea
            ref={chatInputRef}
            className="flex-1 bg-gray-800 border border-gray-700 rounded p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[40px] max-h-[200px] resize-y overflow-auto"
            placeholder="Ask about the repository..."
            value={currentInput}
            onChange={(e) => onInputChange(e.target.value)}
            disabled={loading || !repoInfoExists}
            onKeyDown={handleKeyDown}
            rows={1}
            style={{ lineHeight: '1.5' }}
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded flex items-center justify-center disabled:opacity-50"
            disabled={loading || !currentInput.trim() || !repoInfoExists}
          >
            {loading ? (
              <FaSpinner className="animate-spin" />
            ) : (
              <PiPaperPlaneTilt className="text-lg" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
} 