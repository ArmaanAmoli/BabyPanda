import * as path from 'path';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import os from 'os';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { Database } from 'bun:sqlite';
import { migrations } from './migrations';
import { getProjectName, logError } from '@baby-panda/utils';
import { EXA_PROVIDER, LogType } from '@baby-panda/types';

const dbFilePath = path.join(os.homedir(), '.babypanda', 'db', 'db.db');
const testDbFilePath = path.join(os.homedir(), '.babypanda', 'db', 'db.test.db');

const dbFolderPath = path.join(os.homedir(), '.babypanda', 'db');

const IN_DEV_MODE = process.env['IN_DEV_MODE'] === 'true' ? true : false;

if (!existsSync(dbFolderPath)) {
  mkdirSync(dbFolderPath, { recursive: true });
}
if (!existsSync(dbFilePath)) {
  writeFileSync(dbFilePath, '');
}
if (IN_DEV_MODE && !existsSync(testDbFilePath)) {
  writeFileSync(testDbFilePath, '');
}
const sqliteFilePath = IN_DEV_MODE ? testDbFilePath : dbFilePath;
const dbFile = 'file://' + sqliteFilePath;

const db = drizzle({ client: new Database(sqliteFilePath) });
// Drizzle's `run` only executes the first statement of a multi-statement
// string, so each pragma needs its own call. `foreign_keys` in particular was
// silently never applied, which left orphaned message rows behind every time a
// session was deleted.
db.run('PRAGMA journal_mode = WAL;');
db.run('PRAGMA synchronous = FULL;');
db.run('PRAGMA foreign_keys = ON;');

let migrationsRun = false;

const migrationTable = 'babypanda_migrations';
const migrationTableExists = db.$client
  .query(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`)
  .get(migrationTable);

db.run(
  `CREATE TABLE IF NOT EXISTS ${migrationTable} (name text PRIMARY KEY, applied_at integer NOT NULL);`,
);

// Databases created before migration tracking already have the final column,
// but replaying the older table-rebuild migrations would drop that column and
// erase newer data. Baseline only on the first tracked run; future migrations
// still run normally because the tracking table exists on subsequent starts.
if (!migrationTableExists) {
  const apiKeyColumns = db.$client.query(`PRAGMA table_info(api_keys);`).all() as {
    name: string;
  }[];
  if (apiKeyColumns.some((column) => column.name === 'type')) {
    // Older binaries replayed the api_keys rebuild on every restart, resetting
    // Exa's `web` type to the default `model`. Recover those existing keys as
    // part of the one-time baseline instead of prompting for them again.
    db.$client
      .query(`UPDATE api_keys SET type = 'web' WHERE lower(provider) = lower(?);`)
      .run(EXA_PROVIDER);
    for (const migration of migrations) {
      db.$client
        .query(`INSERT OR IGNORE INTO ${migrationTable} (name, applied_at) VALUES (?, ?);`)
        .run(migration.name, Date.now());
    }
  }
}

/**
 * Runs each embedded migration once and records it in the database. The
 * on-disk record is essential for standalone binaries, whose next process
 * must not replay destructive table-rebuild migrations.
 */
export async function syncWAL(): Promise<void> {
  db.run('PRAGMA wal_checkpoint(TRUNCATE);');
}
export async function runMigrations(): Promise<void> {
  if (migrationsRun) return;
  const appliedRows = db.$client.query(`SELECT name FROM ${migrationTable};`).all() as {
    name: string;
  }[];
  const applied = new Set(appliedRows.map((row) => row.name));

  for (const migration of migrations) {
    if (applied.has(migration.name)) continue;
    for (const statement of migration.statements) {
      try {
        db.run(statement);
      } catch (err) {
        // Preserve support for partially migrated legacy databases, where a
        // statement such as ALTER TABLE ADD column may already have run.
        void logError(
          LogType.db,
          getProjectName(),
          'migrations',
          `Migration ${migration.name} statement failed (may already be applied)`,
          err,
        );
      }
    }
    db.$client
      .query(`INSERT OR IGNORE INTO ${migrationTable} (name, applied_at) VALUES (?, ?);`)
      .run(migration.name, Date.now());
  }
  migrationsRun = true;
}

export { db, dbFile };
