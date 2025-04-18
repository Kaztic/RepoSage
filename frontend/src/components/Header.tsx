import { FaSpinner, FaSearch, FaTrash, FaKey, FaCodeBranch } from 'react-icons/fa';
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
  onOpenCommitSearch?: () => void;
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
  onManageCredentials,
  onOpenCommitSearch
}: HeaderProps) {
  return (
    <header className="flex flex-col border-b border-surface-700 bg-surface-800 shadow-subtle">
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center">
          <TbBrandGithub className="text-3xl mr-2 text-primary-400" />
          <h1 className="text-xl font-bold text-surface-100">RepoSage</h1>
        </div>
        <div className="flex space-x-2 w-2/3">
          <div className="flex-grow relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FaSearch className="text-surface-400 text-sm" />
            </div>
            <input
              type="text"
              placeholder="GitHub Repository URL (e.g., https://github.com/user/repo)"
              className="w-full pl-10 p-2.5 bg-surface-900 rounded-md border border-surface-700 text-surface-200 placeholder-surface-500
                         focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
              value={repoUrl}
              onChange={(e) => onRepoUrlChange(e.target.value)}
            />
          </div>
          <div className="w-1/3 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FaKey className="text-surface-400 text-sm" />
            </div>
            <input
              type="password"
              placeholder="GitHub Token (optional)"
              className="w-full pl-10 p-2.5 bg-surface-900 rounded-md border border-surface-700 text-surface-200 placeholder-surface-500
                         focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
              value={accessToken}
              onChange={(e) => onAccessTokenChange(e.target.value)}
            />
          </div>
          <button
            onClick={onAnalyze}
            disabled={loading || !repoUrl}
            className={`px-4 py-2.5 rounded-md font-medium flex items-center shadow-sm transition-all duration-200 ${
              loading || !repoUrl
                ? 'bg-surface-700 text-surface-400 cursor-not-allowed'
                : 'bg-primary-600 hover:bg-primary-700 text-white'
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
          <div className="flex space-x-1">
            {onOpenCommitSearch && (
              <button
                className="bg-surface-700 hover:bg-surface-600 text-surface-200 p-2.5 rounded-md flex items-center justify-center transition-colors duration-200"
                onClick={onOpenCommitSearch}
                disabled={loading}
                title="Find Commit"
              >
                <FaCodeBranch className="text-lg" />
              </button>
            )}
            {onManageCredentials && (
              <button
                className="bg-surface-700 hover:bg-surface-600 text-surface-200 p-2.5 rounded-md flex items-center justify-center transition-colors duration-200"
                onClick={onManageCredentials}
                disabled={loading}
                title="Manage API Credentials"
              >
                <FaKey className="text-lg" />
              </button>
            )}
            {onClearChat && (
              <button
                className="bg-surface-700 hover:bg-red-600 text-surface-200 hover:text-white p-2.5 rounded-md flex items-center justify-center transition-colors duration-200"
                onClick={onClearChat}
                disabled={loading}
                title="Clear chat history"
              >
                <FaTrash className="text-lg" />
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Progress bar for analysis */}
      {analysisProgress > 0 && analysisProgress < 100 && (
        <div className="w-full h-1 bg-surface-700">
          <div 
            className="h-full bg-primary-500 transition-all duration-300 ease-out"
            style={{ width: `${analysisProgress}%` }}
          />
        </div>
      )}
    </header>
  );
} 