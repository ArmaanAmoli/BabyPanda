import * as path from 'path';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import os from 'os';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { Database } from 'bun:sqlite';

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
db.run('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA foreign_keys = ON;');
export { db, dbFile };
