import { useState, useEffect } from 'react';
import { TbInfoCircle, TbX } from 'react-icons/tb';

interface CredentialsModalProps {
  isOpen: boolean;
  initialValues: {
    geminiApiKey: string;
    githubToken: string;
  };
  onSave: (credentials: { geminiApiKey: string; githubToken: string }) => void;
  onClose: () => void;
}

export default function CredentialsModal({
  isOpen,
  initialValues,
  onSave,
  onClose
}: CredentialsModalProps) {
  const [geminiApiKey, setGeminiApiKey] = useState(initialValues.geminiApiKey || '');
  const [githubToken, setGithubToken] = useState(initialValues.githubToken || '');
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setGeminiApiKey(initialValues.geminiApiKey || '');
      setGithubToken(initialValues.githubToken || '');
      setIsFirstLoad(
        !initialValues.geminiApiKey && !initialValues.githubToken
      );
    }
  }, [isOpen, initialValues]);

  const handleSave = () => {
    onSave({
      geminiApiKey: geminiApiKey.trim(),
      githubToken: githubToken.trim()
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-surface-950/80 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-surface-800 rounded-xl shadow-prominent w-full max-w-md mx-4 overflow-hidden border border-surface-700/50">
        <div className="px-6 py-4 border-b border-surface-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-surface-100">
            {isFirstLoad ? 'Welcome to RepoSage!' : 'API Credentials'}
          </h2>
          {!isFirstLoad && (
            <button
              onClick={onClose}
              className="text-surface-400 hover:text-surface-200 p-1 rounded-full hover:bg-surface-700/50 transition-colors"
            >
              <TbX size={20} />
            </button>
          )}
        </div>

        <div className="px-6 py-5">
          {isFirstLoad && (
            <div className="mb-5 p-4 bg-primary-900/30 rounded-lg text-primary-200 flex items-start border border-primary-700/30">
              <TbInfoCircle className="mr-3 mt-0.5 flex-shrink-0 text-primary-400" />
              <p className="text-sm">
                To use RepoSage, you'll need to provide your Gemini API key and GitHub access token.
                These will be stored securely in your browser.
              </p>
            </div>
          )}

          <div className="mb-5">
            <label className="block text-surface-200 text-sm font-medium mb-2">
              Gemini API Key
            </label>
            <input
              type="password"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              className="w-full p-2.5 bg-surface-900 border border-surface-700 rounded-md text-surface-200 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
              placeholder="Enter your Gemini API key"
            />
            <p className="mt-2 text-xs text-surface-400">
              Get one from{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-primary-400 hover:text-primary-300 transition-colors"
              >
                Google AI Studio
              </a>
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-surface-200 text-sm font-medium mb-2">
              GitHub Access Token
            </label>
            <input
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              className="w-full p-2.5 bg-surface-900 border border-surface-700 rounded-md text-surface-200 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
              placeholder="Enter your GitHub token"
            />
            <p className="mt-2 text-xs text-surface-400">
              Create one with 'repo' scope at{' '}
              <a
                href="https://github.com/settings/tokens"
                target="_blank"
                rel="noreferrer" 
                className="text-primary-400 hover:text-primary-300 transition-colors"
              >
                GitHub Settings
              </a>
            </p>
          </div>
        </div>

        <div className="px-6 py-4 bg-surface-900 flex justify-end">
          {!isFirstLoad && (
            <button
              onClick={onClose}
              className="px-4 py-2 mr-2 text-surface-300 hover:text-surface-100 hover:bg-surface-700/50 rounded transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors shadow-sm"
          >
            Save Credentials
          </button>
        </div>
      </div>
    </div>
  );
} 