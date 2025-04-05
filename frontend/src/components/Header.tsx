import { FaSpinner, FaSearch, FaTrash, FaKey } from 'react-icons/fa';
import { TbBrandGithub } from 'react-icons/tb';
import ProgressBar from './ProgressBar';

type HeaderProps = {
  repoUrl: string;
  accessToken: string;
  loading: boolean;
  analysisProgress: number;
  onRepoUrlChange: (value: string) => void;
  onAccessTokenChange: (value: string) => void;
  onAnalyze: () => void;
  onClearChat?: () => void;
  onManageCredentials?: () => void;
};

export default function Header({
  repoUrl,
  accessToken,
  loading,
  analysisProgress,
  onRepoUrlChange,
  onAccessTokenChange,
  onAnalyze,
  onClearChat,
  onManageCredentials
}: HeaderProps) {
  return (
    <header className="flex flex-col border-b border-gray-700 bg-gray-800">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center">
          <TbBrandGithub className="text-3xl mr-2" />
          <h1 className="text-xl font-bold">RepoSage</h1>
        </div>
        <div className="flex space-x-2 w-2/3">
          <input
            type="text"
            placeholder="GitHub Repository URL (e.g., https://github.com/user/repo)"
            className="flex-grow p-2 bg-gray-700 rounded border border-gray-600 text-white"
            value={repoUrl}
            onChange={(e) => onRepoUrlChange(e.target.value)}
          />
          <input
            type="password"
            placeholder="GitHub Token (optional for private repos)"
            className="w-1/3 p-2 bg-gray-700 rounded border border-gray-600 text-white"
            value={accessToken}
            onChange={(e) => onAccessTokenChange(e.target.value)}
          />
          <button
            onClick={onAnalyze}
            disabled={loading || !repoUrl}
            className={`px-4 py-2 rounded font-medium flex items-center ${
              loading || !repoUrl
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? (
              <>
                <FaSpinner className="animate-spin mr-2" />
                <span>Analyzing...</span>
              </>
            ) : (
              'Analyze'
            )}
          </button>
          {onManageCredentials && (
            <button
              className="bg-purple-600 hover:bg-purple-700 text-white p-2 rounded flex items-center gap-2"
              onClick={onManageCredentials}
              disabled={loading}
              title="Manage API Credentials"
            >
              <FaKey />
            </button>
          )}
          {onClearChat && (
            <button
              className="bg-red-600 hover:bg-red-700 text-white p-2 rounded flex items-center gap-2"
              onClick={onClearChat}
              disabled={loading}
              title="Clear chat history"
            >
              <FaTrash />
            </button>
          )}
        </div>
      </div>
      
      {/* Progress bar for analysis */}
      {analysisProgress > 0 && analysisProgress < 100 && (
        <div className="w-full h-1 bg-gray-700">
          <div 
            className="h-full bg-blue-500 transition-all duration-300 ease-out"
            style={{ width: `${analysisProgress}%` }}
          />
        </div>
      )}
    </header>
  );
} 