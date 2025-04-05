import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Database name and version
const DB_NAME = 'RepoSageDB';
const DB_VERSION = 1;

// Store names
const CREDENTIALS_STORE = 'credentials';

// Define the database schema
interface RepoSageDB extends DBSchema {
  credentials: {
    key: string;
    value: {
      key: string;
      geminiApiKey?: string;
      githubToken?: string;
    };
  };
}

// Initialize the database
export async function initDB(): Promise<IDBPDatabase<RepoSageDB>> {
  return openDB<RepoSageDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create credentials store
      if (!db.objectStoreNames.contains(CREDENTIALS_STORE)) {
        db.createObjectStore(CREDENTIALS_STORE, { keyPath: 'key' });
      }
    },
  });
}

// Credentials Functions

export async function saveCredentials(credentials: { geminiApiKey?: string; githubToken?: string }) {
  const db = await initDB();
  await db.put(CREDENTIALS_STORE, {
    key: 'userCredentials',
    geminiApiKey: credentials.geminiApiKey,
    githubToken: credentials.githubToken
  });
}

export async function getCredentials() {
  const db = await initDB();
  return db.get(CREDENTIALS_STORE, 'userCredentials') || { geminiApiKey: '', githubToken: '' };
}

export async function clearCredentials() {
  const db = await initDB();
  await db.delete(CREDENTIALS_STORE, 'userCredentials');
} 