import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { Role, ReasoningEffort, type ApiKeyType } from '@baby-panda/types';

export const Session = sqliteTable(
  'session',
  {
    id: text('session_id').primaryKey(),
    createdAt: integer('created_at')
      .$defaultFn(() => Date.now())
      .notNull(),
    parentSessionId: text('parent_session_id'),
    messagesCount: integer('messages_count').default(0).notNull(),
    tokensInContextWindow: integer('tokens_in_context_window').default(0).notNull(),
    projectDirectory: text('project_directory').notNull(),
    // Human-facing label, shown in the status bar and `babypanda list`.
    // `createSession` always writes `untitled-<n>`; the default only exists
    // so the column can be added to an existing table.
    name: text('name').notNull().default('untitled'),
    // Last used model settings for this session. Nullable because sessions
    // created before these columns existed have no stored choice; the agent
    // then falls back to its defaults.
    provider: text('provider'),
    model: text('model'),
    reasoningEffort: text('reasoning_effort').$type<ReasoningEffort>(),
  },
  (table) => [
    // A label only has to be unique inside one folder: two projects may both
    // call a session "untitled-1" without colliding.
    uniqueIndex('session_project_directory_name_unique').on(table.projectDirectory, table.name),
  ],
);

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
  // Rows written before this column existed are model providers, so the
  // default keeps them queryable as such.
  type: text('type').$type<ApiKeyType>().notNull().default('model'),
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
