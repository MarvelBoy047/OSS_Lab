// src/lib/db/schema.ts
//import 'server-only';

import { sql } from 'drizzle-orm';
import { text, integer, sqliteTable } from 'drizzle-orm/sqlite-core';

/**
 * Small, explicit record for legacy code that still reads chats.files.
 * Will be removed after all handlers are migrated to attachments/datasets.
 */
export type ChatFile = {
  name: string;
  fileId: string;
};

/**
 * Paperclip uploads (reference docs): pdf/docx/txt only.
 * Embeddings typically via Hugging Face for these lightweight documents.
 */
export type AttachmentFile = {
  id: string;                  // internal upload id
  name: string;                // original filename
  fileId: string;              // basename without extension
  ext: string;                 // pdf | docx | txt
  mime: string;                // e.g., application/pdf
  size: number;                // bytes
  uploadedAt: string;          // ISO timestamp
  source: 'paperclip';         // fixed discriminator
  embeddingProvider?: 'huggingface' | 'openai' | 'local';
  embeddingModel?: string;     // e.g., sentence-transformers/all-MiniLM-L6-v2
  embeddingReady: boolean;     // true once vectors written
  notes?: string;              // optional UI notes
};

/**
 * Sidebar dataset uploads: csv/json/xlsx intended for analysis & viz.
 * Vectorized flag indicates chunks embedded for semantic retrieval.
 */
export type DatasetFile = {
  id: string;                  // internal upload id
  name: string;
  fileId: string;
  ext: string;                 // csv | json | xlsx
  mime: string;
  size: number;
  uploadedAt: string;          // ISO timestamp
  source: 'sidebar';           // fixed discriminator
  rows?: number;               // optional row count
  cols?: number;               // optional column count
  schema?: Array<{ name: string; type: string }>;
  vectorized: boolean;         // true once chunks embedded
  embeddingProvider?: 'huggingface' | 'openai' | 'local';
  embeddingModel?: string;
  notes?: string;
};

// Chats table: now carries separate collections for attachments vs datasets.
export const chats = sqliteTable('chats', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: text('createdAt').notNull(),
  focusMode: text('focusMode').notNull(),

  // NEW: paperclip documents (pdf/docx/txt)
  attachments: text('attachments', { mode: 'json' })
    .$type<AttachmentFile[]>()
    .default(sql`'[]'`),

  // NEW: sidebar datasets (csv/json/xlsx)
  datasets: text('datasets', { mode: 'json' })
    .$type<DatasetFile[]>()
    .default(sql`'[]'`),

  // DEPRECATED: legacy field some routes may still use; migrate away gradually
  files: text('files', { mode: 'json' })
    .$type<ChatFile[]>()
    .default(sql`'[]'`),
});

// Message log (unchanged)
export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey(),
  content: text('content').notNull(),
  chatId: text('chatId').notNull(),
  messageId: text('messageId').notNull(),
  role: text('role', { enum: ['assistant', 'user'] }),
  meta: text('metadata', { mode: 'json' }),
});

// Agent session state (unchanged)
export const agentSessions = sqliteTable('agent_sessions', {
  id: text('id').primaryKey(),
  activeAgent: text('activeAgent', {
    enum: ['orchestrator', 'initial_analysis', 'notebook_coder', 'presenter'],
  }).default('orchestrator'),
  analysisPlan: text('analysisPlan'),
  hasFileReadingError: integer('hasFileReadingError').default(0),
  currentContext: text('currentContext').default('default'),
  searchResults: text('searchResults', { mode: 'json' }),
  providerKey: text('providerKey').default('groq'),
  modelKey: text('modelKey').default('llama3-8b-8192'),
});

// Notebook cells (unchanged)
export const notebookCells = sqliteTable('notebook_cells', {
  id: integer('id').primaryKey(),
  chatId: text('chatId').notNull(),
  cellNumber: integer('cellNumber').notNull(),
  type: text('type', { enum: ['code', 'markdown', 'conclusion'] }).notNull(),
  content: text('content').notNull(),
});

// Presentation slides (unchanged)
export const presentationSlides = sqliteTable('presentation_slides', {
  id: integer('id').primaryKey(),
  chatId: text('chatId').notNull(),
  slideNumber: integer('slideNumber').notNull(),
  slideData: text('slideData', { mode: 'json' }).notNull(),
});
