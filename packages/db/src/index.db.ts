import * as path from 'path';
import { drizzle } from 'drizzle-orm/libsql';
import os from 'os';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { sql } from 'drizzle-orm';

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

const db = drizzle(dbFile);
await db.run(sql`PRAGMA journal_mode = WAL;`);
await db.run(sql`PRAGMA synchronous = NORMAL;`);
await db.run(sql`PRAGMA foreign_keys = ON;`);
export { db, dbFile };
