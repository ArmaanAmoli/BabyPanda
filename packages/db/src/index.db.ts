import * as path from 'path';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import os from 'os';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { Database } from 'bun:sqlite';
import { migrations } from './migrations';

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

/**
 * Runs all pending embedded database migrations. Safe to call multiple times;
 * migrations are idempotent (CREATE TABLE IF NOT EXISTS, ALTER TABLE ADD
 * columns that may already exist may error on re-run, so we guard with a
 * module-level flag).
 */
export async function runMigrations(): Promise<void> {
  if (migrationsRun) return;
  for (const migration of migrations) {
    for (const statement of migration.statements) {
      try {
        db.run(statement);
      } catch (err) {
        // Some statements (like ALTER TABLE ADD column) may fail if already
        // applied. Log and continue rather than failing the whole migration.
        console.warn(
          `Migration ${migration.name} statement failed (may already be applied): ${String(err)}`,
        );
      }
    }
  }
  migrationsRun = true;
}

export { db, dbFile };
