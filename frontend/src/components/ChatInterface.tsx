import { useRef } from 'react';
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
  chatInputRef: React.RefObject<HTMLTextAreaElement>;
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
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 overflow-auto p-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <TbBrandGithub className="text-5xl mb-4" />
            <p className="text-xl font-medium">Welcome to RepoSage</p>
            <p className="text-sm mt-2">
              Enter a GitHub repository URL and click Analyze to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-3xl rounded-lg p-4 ${
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
                      components={{
                        code({node, className, children, ...props}: any) {
                          const match = /language-(\w+)/.exec(className || '');
                          const inline = !className || !match;
                          return !inline && match ? (
                            <SyntaxHighlighter
                              style={atomDark}
                              language={match[1]}
                              PreTag="div"
                              {...props}
                            >
                              {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                          ) : (
                            <code className={className} {...props}>
                              {children}
                            </code>
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
            <div ref={messagesEndRef} />
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