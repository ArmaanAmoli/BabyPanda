import * as path from 'path';
import { drizzle } from 'drizzle-orm/libsql';
import os from 'os';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { ENV } from '@/env.config';

const dbFilePath = path.join(os.homedir(), '.babypanda', 'db', 'db.db');
const testDbFilePath = path.join(os.homedir(), '.babypanda', 'db', 'db.test.db');

const dbFolderPath = path.join(os.homedir(), '.babypanda', 'db');

const IN_DEV_MODE = ENV.IN_DEV_MODE;

if (!existsSync(dbFolderPath)) {
  mkdirSync(dbFolderPath, { recursive: true });
}
if (!existsSync(dbFilePath)) {
  writeFileSync(dbFilePath, '');
}
if (IN_DEV_MODE && !existsSync(testDbFilePath)) {
  writeFileSync(testDbFilePath, '');
}
const dbFile = 'file://' + (IN_DEV_MODE ? testDbFilePath : dbFilePath);

const db = drizzle(dbFile);
export { db };
