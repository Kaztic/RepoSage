// Add type declarations for untyped modules
declare module 'react-syntax-highlighter';
declare module 'react-syntax-highlighter/dist/cjs/styles/prism';
declare module 'remark-gfm';

// Existing type declarations
export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
};

export type FileStructure = {
  [key: string]: any;
};

export type RelevantFile = {
  path: string;
  content: string;
};

export type RepoInfo = {
  name: string;
  description: string;
  branches: string[];
  default_branch: string;
};

export type DiffBlock = {
  header: string | null;
  removed: string[];
  added: string[];
  removedLineNumbers: number[];
  addedLineNumbers: number[];
};

export type Commit = {
  hash: string;
  short_hash: string;
  author: string;
  date: string;
  message: string;
  stats: {
    files_changed: number;
    insertions: number;
    deletions: number;
  };
  file_changes: any[];
}; 