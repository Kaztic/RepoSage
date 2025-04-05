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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-white">
            {isFirstLoad ? 'Welcome to RepoSage!' : 'API Credentials'}
          </h2>
          {!isFirstLoad && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <TbX size={24} />
            </button>
          )}
        </div>

        <div className="px-6 py-4">
          {isFirstLoad && (
            <div className="mb-4 p-3 bg-blue-900/30 rounded-lg text-blue-300 flex items-start">
              <TbInfoCircle className="mr-2 mt-1 flex-shrink-0" />
              <p className="text-sm">
                To use RepoSage, you'll need to provide your Gemini API key and GitHub access token.
                These will be stored securely in your browser.
              </p>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-gray-300 text-sm font-medium mb-2">
              Gemini API Key
            </label>
            <input
              type="password"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md text-white"
              placeholder="Enter your Gemini API key"
            />
            <p className="mt-1 text-xs text-gray-400">
              Get one from{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-blue-400 hover:underline"
              >
                Google AI Studio
              </a>
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-gray-300 text-sm font-medium mb-2">
              GitHub Access Token
            </label>
            <input
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md text-white"
              placeholder="Enter your GitHub token"
            />
            <p className="mt-1 text-xs text-gray-400">
              Create one with 'repo' scope at{' '}
              <a
                href="https://github.com/settings/tokens"
                target="_blank"
                rel="noreferrer" 
                className="text-blue-400 hover:underline"
              >
                GitHub Settings
              </a>
            </p>
          </div>
        </div>

        <div className="px-6 py-3 bg-gray-950 flex justify-end">
          {!isFirstLoad && (
            <button
              onClick={onClose}
              className="px-4 py-2 mr-2 text-gray-300 hover:text-white"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
          >
            Save Credentials
          </button>
        </div>
      </div>
    </div>
  );
} 