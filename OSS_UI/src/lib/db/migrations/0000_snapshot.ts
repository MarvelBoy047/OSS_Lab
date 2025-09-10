// src/lib/db/migrations/0000_snapshot.ts
import { sql } from 'drizzle-orm';
import { text, integer, sqliteTable } from 'drizzle-orm/sqlite-core';

// This is a snapshot of your current schema
export const chats = sqliteTable('chats', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: text('createdAt').notNull(),
  focusMode: text('focusMode').notNull(),
  files: text('files', { mode: 'json' }).$type<File[]>().default(sql`'[]'`),
});

export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey(),
  content: text('content').notNull(),
  chatId: text('chatId').notNull(),
  messageId: text('messageId').notNull(),
  role: text('role', { enum: ['assistant', 'user'] }),
  meta: text('metadata', { mode: 'json' }),
});

export const agentSessions = sqliteTable('agent_sessions', {
  id: text('id').primaryKey(),
  activeAgent: text('activeAgent', { 
    enum: ['orchestrator', 'initial_analysis', 'notebook_coder', 'presenter'] 
  }).default('orchestrator'),
  analysisPlan: text('analysisPlan'),
  hasFileReadingError: integer('hasFileReadingError').default(0),
  currentContext: text('currentContext').default('default'),
  searchResults: text('searchResults', { mode: 'json' }),
  providerKey: text('providerKey').default('groq'),
  modelKey: text('modelKey').default('llama3-8b-8192')
});

export const notebookCells = sqliteTable('notebook_cells', {
  id: integer('id').primaryKey(),
  chatId: text('chatId').notNull(),
  cellNumber: integer('cellNumber').notNull(),
  type: text('type', { enum: ['code', 'markdown', 'conclusion'] }).notNull(),
  content: text('content').notNull(),
});

export const presentationSlides = sqliteTable('presentation_slides', {
  id: integer('id').primaryKey(),
  chatId: text('chatId').notNull(),
  slideNumber: integer('slideNumber').notNull(),
  slideData: text('slideData', { mode: 'json' }).notNull(),
});

// Add this export for the migration
export const _meta = {
  version: 1,
  dialect: 'sqlite',
  schema: '',
  timestamps: {
    created_at: 'created_at',
    updated_at: 'updated_at',
  },
};