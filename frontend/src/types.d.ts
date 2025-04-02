// Add type declarations for untyped modules
declare module 'react-syntax-highlighter';
declare module 'react-syntax-highlighter/dist/cjs/styles/prism';
declare module 'remark-gfm';

// Existing type declarations
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface RepoInfo {
  name: string;
  description: string;
  branches: string[];
  default_branch: string;
}

export interface FileStructure {
  [key: string]: null | FileStructure;
}

export interface Commit {
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
  file_changes?: FileChange[];
}

export interface FileChange {
  path: string;
  change_type: string;
  insertions: number;
  deletions: number;
}

export interface AstInfo {
  functions: FunctionInfo[];
  classes: ClassInfo[];
  imports: ImportInfo[];
  file_path: string;
  error?: string;
}

export interface FunctionInfo {
  name: string;
  line: number;
  args: string[];
  docstring: string | null;
  complexity?: number;
}

export interface ClassInfo {
  name: string;
  line: number;
  bases: string[];
  methods: FunctionInfo[];
  docstring: string | null;
}

export interface ImportInfo {
  name: string;
  alias: string | null;
}

export interface CodeMetrics {
  file_path: string;
  metrics: {
    cyclomatic_complexity: number;
    maintainability_index?: number;
    lines_of_code?: number;
    comment_ratio?: number;
  };
  functions?: FunctionInfo[];
  recommendations?: string;
  error?: string;
}

export interface TechnicalDebtScore {
  repository: string;
  score: number;
  metrics: {
    code_complexity: number;
    documentation: number;
    test_coverage: number;
    code_duplication: number;
    outdated_dependencies: number;
  };
  files: {
    file: string;
    complexity: number;
    maintainability: number;
  }[];
}

export interface UserInfo {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
  is_active: boolean;
}

export interface Token {
  access_token: string;
  token_type: string;
}

export interface ApiKey {
  id: number;
  key_name: string;
  key_prefix: string;
  service: string;
  created_at: string;
}

export type RelevantFile = {
  path: string;
  content: string;
};

export type DiffBlock = {
  header: string | null;
  removed: string[];
  added: string[];
  removedLineNumbers: number[];
  addedLineNumbers: number[];
}; 