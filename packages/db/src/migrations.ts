/**
 * Embedded database migrations.
 *
 * These are the SQL migration files from packages/db/drizzle/, embedded as
 * strings so the standalone binary can run them without needing the
 * filesystem or drizzle-kit. Each entry is one migration file's full SQL
 * (already split on `--> statement-breakpoint` into individual statements).
 *
 * Migrations are ordered by directory name (timestamp prefix), oldest first.
 */

export type Migration = {
  name: string;
  statements: string[];
};

export const migrations: Migration[] = [
  {
    name: '20260920234953_Init',
    statements: [
      `CREATE TABLE IF NOT EXISTS \`api_keys\` (
\t\`provider\` text,
\t\`endpoint\` text,
\t\`key\` text PRIMARY KEY
);`,
      `CREATE TABLE IF NOT EXISTS \`compaction_results\` (
\t\`session_id\` text,
\t\`created_at\` integer,
\t\`content\` text,
\tCONSTRAINT \`compaction_results_pk\` PRIMARY KEY(\`session_id\`, \`created_at\`),
\tCONSTRAINT \`fk_compaction_results_session_id_session_session_id_fk\` FOREIGN KEY (\`session_id\`) REFERENCES \`session\`(\`session_id\`)
);`,
      `CREATE TABLE IF NOT EXISTS \`message\` (
\t\`message_index\` integer,
\t\`session_id\` text,
\t\`created_at\` text DEFAULT CURRENT_TIMESTAMP,
\t\`content\` text,
\t\`role\` text,
\tCONSTRAINT \`message_pk\` PRIMARY KEY(\`message_index\`, \`session_id\`),
\tCONSTRAINT \`fk_message_session_id_session_session_id_fk\` FOREIGN KEY (\`session_id\`) REFERENCES \`session\`(\`session_id\`)
);`,
      `CREATE TABLE IF NOT EXISTS \`session\` (
\t\`session_id\` text PRIMARY KEY,
\t\`created_at\` text DEFAULT CURRENT_TIMESTAMP,
\t\`parent_session_id\` text,
\t\`messages_count\` integer DEFAULT 0,
\t\`tokens_in_context_window\` integer DEFAULT 0,
\t\`project_directory\` text
);`,
    ],
  },
  {
    name: '20260921002840_timestamp_number',
    statements: [
      `PRAGMA foreign_keys=OFF;`,
      `CREATE TABLE \`__new_message\` (
\t\`message_index\` integer,
\t\`session_id\` text,
\t\`created_at\` integer DEFAULT 1789950520329,
\t\`content\` text,
\t\`role\` text,
\tCONSTRAINT \`message_pk\` PRIMARY KEY(\`message_index\`, \`session_id\`),
\tCONSTRAINT \`fk_message_session_id_session_session_id_fk\` FOREIGN KEY (\`session_id\`) REFERENCES \`session\`(\`session_id\`)
);`,
      `INSERT INTO \`__new_message\`(\`message_index\`, \`session_id\`, \`created_at\`, \`content\`, \`role\`) SELECT \`message_index\`, \`session_id\`, \`created_at\`, \`content\`, \`role\` FROM \`message\`;`,
      `DROP TABLE \`message\`;`,
      `ALTER TABLE \`__new_message\` RENAME TO \`message\`;`,
      `PRAGMA foreign_keys=ON;`,
      `PRAGMA foreign_keys=OFF;`,
      `CREATE TABLE \`__new_session\` (
\t\`session_id\` text PRIMARY KEY,
\t\`created_at\` integer DEFAULT 1789950520329,
\t\`parent_session_id\` text,
\t\`messages_count\` integer DEFAULT 0,
\t\`tokens_in_context_window\` integer DEFAULT 0,
\t\`project_directory\` text
);`,
      `INSERT INTO \`__new_session\`(\`session_id\`, \`created_at\`, \`parent_session_id\`, \`messages_count\`, \`tokens_in_context_window\`, \`project_directory\`) SELECT \`session_id\`, \`created_at\`, \`parent_session_id\`, \`messages_count\`, \`tokens_in_context_window\`, \`project_directory\` FROM \`session\`;`,
      `DROP TABLE \`session\`;`,
      `ALTER TABLE \`__new_session\` RENAME TO \`session\`;`,
      `PRAGMA foreign_keys=ON;`,
    ],
  },
  {
    name: '20260924151948_is_tool_call_result_calssification_of_message',
    statements: [
      `ALTER TABLE \`message\` ADD \`is_tool_result\` integer DEFAULT false NOT NULL;`,
      `PRAGMA foreign_keys=OFF;`,
      `CREATE TABLE \`__new_message\` (
\t\`message_index\` integer,
\t\`session_id\` text,
\t\`created_at\` integer DEFAULT 1790263188401,
\t\`content\` text,
\t\`role\` text,
\t\`is_tool_result\` integer DEFAULT false NOT NULL,
\tCONSTRAINT \`message_pk\` PRIMARY KEY(\`message_index\`, \`session_id\`),
\tCONSTRAINT \`fk_message_session_id_session_session_id_fk\` FOREIGN KEY (\`session_id\`) REFERENCES \`session\`(\`session_id\`)
);`,
      `INSERT INTO \`__new_message\`(\`message_index\`, \`session_id\`, \`created_at\`, \`content\`, \`role\`) SELECT \`message_index\`, \`session_id\`, \`created_at\`, \`content\`, \`role\` FROM \`message\`;`,
      `DROP TABLE \`message\`;`,
      `ALTER TABLE \`__new_message\` RENAME TO \`message\`;`,
      `PRAGMA foreign_keys=ON;`,
      `PRAGMA foreign_keys=OFF;`,
      `CREATE TABLE \`__new_session\` (
\t\`session_id\` text PRIMARY KEY,
\t\`created_at\` integer DEFAULT 1790263188401,
\t\`parent_session_id\` text,
\t\`messages_count\` integer DEFAULT 0,
\t\`tokens_in_context_window\` integer DEFAULT 0,
\t\`project_directory\` text
);`,
      `INSERT INTO \`__new_session\`(\`session_id\`, \`created_at\`, \`parent_session_id\`, \`messages_count\`, \`tokens_in_context_window\`, \`project_directory\`) SELECT \`session_id\`, \`created_at\`, \`parent_session_id\`, \`messages_count\`, \`tokens_in_context_window\`, \`project_directory\` FROM \`session\`;`,
      `DROP TABLE \`session\`;`,
      `ALTER TABLE \`__new_session\` RENAME TO \`session\`;`,
      `PRAGMA foreign_keys=ON;`,
    ],
  },
  {
    name: '20261006020940_cascade_for_messages_if_session_deletes',
    statements: [
      `PRAGMA foreign_keys=OFF;`,
      `CREATE TABLE \`__new_message\` (
\t\`message_index\` integer,
\t\`session_id\` text,
\t\`created_at\` integer DEFAULT 1791252580781,
\t\`content\` text,
\t\`role\` text,
\t\`is_tool_result\` integer DEFAULT false NOT NULL,
\tCONSTRAINT \`message_pk\` PRIMARY KEY(\`message_index\`, \`session_id\`),
\tCONSTRAINT \`fk_message_session_id_session_session_id_fk\` FOREIGN KEY (\`session_id\`) REFERENCES \`session\`(\`session_id\`) ON DELETE CASCADE
);`,
      `INSERT INTO \`__new_message\`(\`message_index\`, \`session_id\`, \`created_at\`, \`content\`, \`role\`, \`is_tool_result\`) SELECT \`message_index\`, \`session_id\`, \`created_at\`, \`content\`, \`role\`, \`is_tool_result\` FROM \`message\`;`,
      `DROP TABLE \`message\`;`,
      `ALTER TABLE \`__new_message\` RENAME TO \`message\`;`,
      `PRAGMA foreign_keys=ON;`,
      `PRAGMA foreign_keys=OFF;`,
      `CREATE TABLE \`__new_session\` (
\t\`session_id\` text PRIMARY KEY,
\t\`created_at\` integer DEFAULT 1791252580781,
\t\`parent_session_id\` text,
\t\`messages_count\` integer DEFAULT 0,
\t\`tokens_in_context_window\` integer DEFAULT 0,
\t\`project_directory\` text
);`,
      `INSERT INTO \`__new_session\`(\`session_id\`, \`created_at\`, \`parent_session_id\`, \`messages_count\`, \`tokens_in_context_window\`, \`project_directory\`) SELECT \`session_id\`, \`created_at\`, \`parent_session_id\`, \`messages_count\`, \`tokens_in_context_window\`, \`project_directory\` FROM \`session\`;`,
      `DROP TABLE \`session\`;`,
      `ALTER TABLE \`__new_session\` RENAME TO \`session\`;`,
      `PRAGMA foreign_keys=ON;`,
    ],
  },
  {
    name: '20261006024909_cascade_for_compaction_Summary',
    statements: [
      `PRAGMA foreign_keys=OFF;`,
      `CREATE TABLE \`__new_message\` (
\t\`message_index\` integer,
\t\`session_id\` text,
\t\`created_at\` integer DEFAULT 1791254949952,
\t\`content\` text,
\t\`role\` text,
\t\`is_tool_result\` integer DEFAULT false NOT NULL,
\tCONSTRAINT \`message_pk\` PRIMARY KEY(\`message_index\`, \`session_id\`),
\tCONSTRAINT \`fk_message_session_id_session_session_id_fk\` FOREIGN KEY (\`session_id\`) REFERENCES \`session\`(\`session_id\`) ON DELETE CASCADE
);`,
      `INSERT INTO \`__new_message\`(\`message_index\`, \`session_id\`, \`created_at\`, \`content\`, \`role\`, \`is_tool_result\`) SELECT \`message_index\`, \`session_id\`, \`created_at\`, \`content\`, \`role\`, \`is_tool_result\` FROM \`message\`;`,
      `DROP TABLE \`message\`;`,
      `ALTER TABLE \`__new_message\` RENAME TO \`message\`;`,
      `PRAGMA foreign_keys=ON;`,
      `PRAGMA foreign_keys=OFF;`,
      `CREATE TABLE \`__new_session\` (
\t\`session_id\` text PRIMARY KEY,
\t\`created_at\` integer DEFAULT 1791254949952,
\t\`parent_session_id\` text,
\t\`messages_count\` integer DEFAULT 0,
\t\`tokens_in_context_window\` integer DEFAULT 0,
\t\`project_directory\` text
);`,
      `INSERT INTO \`__new_session\`(\`session_id\`, \`created_at\`, \`parent_session_id\`, \`messages_count\`, \`tokens_in_context_window\`, \`project_directory\`) SELECT \`session_id\`, \`created_at\`, \`parent_session_id\`, \`messages_count\`, \`tokens_in_context_window\`, \`project_directory\` FROM \`session\`;`,
      `DROP TABLE \`session\`;`,
      `ALTER TABLE \`__new_session\` RENAME TO \`session\`;`,
      `PRAGMA foreign_keys=ON;`,
      `PRAGMA foreign_keys=OFF;`,
      `CREATE TABLE \`__new_compaction_results\` (
\t\`session_id\` text,
\t\`created_at\` integer,
\t\`content\` text,
\tCONSTRAINT \`compaction_results_pk\` PRIMARY KEY(\`session_id\`, \`created_at\`),
\tCONSTRAINT \`fk_compaction_results_session_id_session_session_id_fk\` FOREIGN KEY (\`session_id\`) REFERENCES \`session\`(\`session_id\`) ON DELETE CASCADE
);`,
      `INSERT INTO \`__new_compaction_results\`(\`session_id\`, \`created_at\`, \`content\`) SELECT \`session_id\`, \`created_at\`, \`content\` FROM \`compaction_results\`;`,
      `DROP TABLE \`compaction_results\`;`,
      `ALTER TABLE \`__new_compaction_results\` RENAME TO \`compaction_results\`;`,
      `PRAGMA foreign_keys=ON;`,
    ],
  },
  {
    name: '20261106124453_enforcing_non_null',
    statements: [
      `ALTER TABLE \`message\` RENAME COLUMN \`message_index\` TO \`seq\`;`,
      `ALTER TABLE \`message\` ADD \`id\` text;`,
      `PRAGMA foreign_keys=OFF;`,
      `CREATE TABLE \`__new_api_keys\` (
\t\`provider\` text NOT NULL,
\t\`endpoint\` text NOT NULL,
\t\`key\` text PRIMARY KEY
);`,
      `INSERT INTO \`__new_api_keys\`(\`provider\`, \`endpoint\`, \`key\`) SELECT \`provider\`, \`endpoint\`, \`key\` FROM \`api_keys\`;`,
      `DROP TABLE \`api_keys\`;`,
      `ALTER TABLE \`__new_api_keys\` RENAME TO \`api_keys\`;`,
      `PRAGMA foreign_keys=ON;`,
      `PRAGMA foreign_keys=OFF;`,
      `CREATE TABLE \`__new_message\` (
\t\`id\` text PRIMARY KEY,
\t\`session_id\` text NOT NULL,
\t\`content\` text NOT NULL,
\t\`role\` text NOT NULL,
\t\`seq\` integer NOT NULL,
\tCONSTRAINT \`fk_message_session_id_session_session_id_fk\` FOREIGN KEY (\`session_id\`) REFERENCES \`session\`(\`session_id\`) ON DELETE CASCADE
);`,
      `INSERT INTO \`__new_message\`(\`seq\`, \`session_id\`, \`content\`, \`role\`) SELECT \`seq\`, \`session_id\`, \`content\`, \`role\` FROM \`message\`;`,
      `DROP TABLE \`message\`;`,
      `ALTER TABLE \`__new_message\` RENAME TO \`message\`;`,
      `PRAGMA foreign_keys=ON;`,
      `PRAGMA foreign_keys=OFF;`,
      `CREATE TABLE \`__new_session\` (
\t\`session_id\` text PRIMARY KEY,
\t\`created_at\` integer DEFAULT 1793969071049 NOT NULL,
\t\`parent_session_id\` text,
\t\`messages_count\` integer DEFAULT 0 NOT NULL,
\t\`tokens_in_context_window\` integer DEFAULT 0 NOT NULL,
\t\`project_directory\` text NOT NULL
);`,
      `INSERT INTO \`__new_session\`(\`session_id\`, \`created_at\`, \`parent_session_id\`, \`messages_count\`, \`tokens_in_context_window\`, \`project_directory\`) SELECT \`session_id\`, \`created_at\`, \`parent_session_id\`, \`messages_count\`, \`tokens_in_context_window\`, \`project_directory\` FROM \`session\`;`,
      `DROP TABLE \`session\`;`,
      `ALTER TABLE \`__new_session\` RENAME TO \`session\`;`,
      `PRAGMA foreign_keys=ON;`,
      `DROP TABLE \`compaction_results\`;`,
    ],
  },
  {
    name: '20261114091534_correcting_default_timestamp',
    statements: [
      `PRAGMA foreign_keys=OFF;`,
      `CREATE TABLE \`__new_session\` (
\t\`session_id\` text PRIMARY KEY,
\t\`created_at\` integer NOT NULL,
\t\`parent_session_id\` text,
\t\`messages_count\` integer DEFAULT 0 NOT NULL,
\t\`tokens_in_context_window\` integer DEFAULT 0 NOT NULL,
\t\`project_directory\` text NOT NULL
);`,
      `INSERT INTO \`__new_session\`(\`session_id\`, \`created_at\`, \`parent_session_id\`, \`messages_count\`, \`tokens_in_context_window\`, \`project_directory\`) SELECT \`session_id\`, \`created_at\`, \`parent_session_id\`, \`messages_count\`, \`tokens_in_context_window\`, \`project_directory\` FROM \`session\`;`,
      `DROP TABLE \`session\`;`,
      `ALTER TABLE \`__new_session\` RENAME TO \`session\`;`,
      `PRAGMA foreign_keys=ON;`,
    ],
  },
  {
    name: '20261115013904_add_api_key_type',
    statements: [
      `ALTER TABLE \`api_keys\` ADD \`type\` text DEFAULT 'model' NOT NULL;`,
    ],
  },
];
