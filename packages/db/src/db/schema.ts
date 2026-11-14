import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { Role } from '@baby-panda/types';

export const Session = sqliteTable('session', {
  id: text('session_id').primaryKey(),
  createdAt: integer('created_at')
    .$defaultFn(() => Date.now())
    .notNull(),
  parentSessionId: text('parent_session_id'),
  messagesCount: integer('messages_count').default(0).notNull(),
  tokensInContextWindow: integer('tokens_in_context_window').default(0).notNull(),
  projectDirectory: text('project_directory').notNull(),
});

export const Message = sqliteTable('message', {
  id: text('id').primaryKey(),
  sessionId: text('session_id')
    .references(() => Session.id, { onDelete: 'cascade' })
    .notNull(),
  content: text('content').notNull(),
  role: text('role').$type<Role>().notNull(),
  sequence: integer('seq').notNull(),
});

export const ApiKeys = sqliteTable('api_keys', {
  provider: text('provider').notNull(),
  endpoint: text('endpoint').notNull(),
  key: text('key').primaryKey().notNull(),
});

// export const CompactionResults = sqliteTable(
//   'compaction_results',
//   {
//     sessionId: text('session_id').references(() => Session.id, { onDelete: 'cascade' }),
//     createdAt: integer('created_at'),
//     content: text('content'),
//   },
//   (table) => [primaryKey({ columns: [table.sessionId, table.createdAt] })],
// );
