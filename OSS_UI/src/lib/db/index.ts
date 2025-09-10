// src/lib/db/index.ts
import 'server-only';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import * as schema from './schema';

if (typeof window !== 'undefined') {
  throw new Error('This module should only be used on the server');
}

// Resolve data directory (DATA_DIR env or project root)
const DATA_DIR = process.env.DATA_DIR || process.cwd();
const dataDir = path.join(DATA_DIR, 'data');

// Ensure data directory exists
try {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`Created data directory at: ${dataDir}`);
  }
} catch (error) {
  console.error('Failed to create data directory:', error);
  throw new Error('Cannot initialize database - directory creation failed');
}

// Open SQLite and enable WAL
const dbPath = path.join(dataDir, 'db.sqlite');
const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');

const db = drizzle(sqlite, { schema });

try {
  // Drizzle Kit outputs migrations to "<projectRoot>/drizzle"
  const migrationsFolder = path.join(process.cwd(), 'drizzle');
  const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');
  const hasMigrations = fs.existsSync(journalPath);

  if (hasMigrations) {
    console.log(`Applying drizzle migrations from: ${migrationsFolder}`);
    migrate(db, { migrationsFolder });
    console.log('Database migrations completed successfully');
  } else {
    console.log('No drizzle migrations found; ensuring tables exist (idempotent)');
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        focusMode TEXT NOT NULL,
        files TEXT DEFAULT '[]'
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY,
        content TEXT NOT NULL,
        chatId TEXT NOT NULL,
        messageId TEXT NOT NULL,
        role TEXT,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS agent_sessions (
        id TEXT PRIMARY KEY,
        activeAgent TEXT DEFAULT 'orchestrator',
        analysisPlan TEXT,
        hasFileReadingError INTEGER DEFAULT 0,
        currentContext TEXT DEFAULT 'default',
        searchResults TEXT,
        providerKey TEXT DEFAULT 'groq',
        modelKey TEXT DEFAULT 'openai/gpt-oss-20b'
      );

      CREATE TABLE IF NOT EXISTS notebook_cells (
        id INTEGER PRIMARY KEY,
        chatId TEXT NOT NULL,
        cellNumber INTEGER NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS presentation_slides (
        id INTEGER PRIMARY KEY,
        chatId TEXT NOT NULL,
        slideNumber INTEGER NOT NULL,
        slideData TEXT NOT NULL
      );
    `);
    console.log('Database tables ensured successfully');
  }
} catch (error) {
  console.error('Database initialization failed:', error);
  throw new Error('Failed to initialize database schema');
}

export default db;
