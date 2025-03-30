import { useState } from 'react';
import { FaSpinner } from 'react-icons/fa';
import { TbBrandGithub } from 'react-icons/tb';

type WelcomeScreenProps = {
  repoUrl: string;
  accessToken: string;
  loading: boolean;
  analysisProgress: number;
  setRepoUrl: (url: string) => void;
  setAccessToken: (token: string) => void;
  onAnalyze: () => void;
};

export default function WelcomeScreen({
  repoUrl,
  accessToken,
  loading,
  analysisProgress,
  setRepoUrl,
  setAccessToken,
  onAnalyze
}: WelcomeScreenProps) {
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAnalyze();
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <div className="max-w-xl w-full">
        <h1 className="text-2xl font-bold text-center mb-6">
          RepoSage <span className="text-blue-400">AI</span>
        </h1>
        <p className="text-center text-gray-400 mb-8">
          Enter a GitHub repository URL and click Analyze to get started.
        </p>
        
        {/* URL Input Form */}
        <form 
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div>
            <div className="flex space-x-2 mb-3">
              <input
                type="text"
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://github.com/username/repo"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                disabled={loading}
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-medium flex items-center space-x-2 disabled:opacity-50"
                disabled={!repoUrl.trim() || loading}
              >
                {loading ? <FaSpinner className="animate-spin" /> : <TbBrandGithub />}
                <span>{loading ? 'Analyzing...' : 'Analyze'}</span>
              </button>
            </div>
            
            <details className="text-sm text-gray-500">
              <summary className="cursor-pointer hover:text-gray-400">
                Private Repository? (Optional Access Token)
              </summary>
              <div className="mt-2">
                <input
                  type="password"
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="github_pat_..."
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  disabled={loading}
                />
              </div>
            </details>
          </div>
        </form>
        
        {/* Analysis Progress */}
        {loading && (
          <div className="mt-8 w-full">
            <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${analysisProgress}%` }}
              ></div>
            </div>
            <p className="text-center text-sm text-gray-500 mt-2">
              {analysisProgress < 100
                ? 'Analyzing repository...'
                : 'Analysis complete!'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 