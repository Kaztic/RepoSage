import { useRef, useEffect } from 'react';
import { FaSpinner } from 'react-icons/fa';
import { PiPaperPlaneTilt } from 'react-icons/pi';
import { TbBrandGithub } from 'react-icons/tb';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { ChatMessage } from '../types';

type ChatInterfaceProps = {
  messages: ChatMessage[];
  currentInput: string;
  loading: boolean;
  repoInfoExists: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  chatInputRef: React.RefObject<HTMLInputElement>;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
};

export default function ChatInterface({
  messages,
  currentInput,
  loading,
  repoInfoExists,
  messagesEndRef,
  chatInputRef,
  onInputChange,
  onSendMessage
}: ChatInterfaceProps) {
  // Local ref for chat container
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full max-h-full">
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
                  )}
                </div>
              </div>
            ))}
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
          <input
            ref={chatInputRef}
            className="flex-1 bg-gray-800 border border-gray-700 rounded p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[40px] max-h-[200px]"
            placeholder="Ask about the repository..."
            value={currentInput}
            onChange={(e) => onInputChange(e.target.value)}
            disabled={loading || !repoInfoExists}
            onKeyDown={handleKeyDown}
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