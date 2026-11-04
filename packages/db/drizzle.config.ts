import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import os from 'os';
import path from 'path';

const dbFilePath = path.join(os.homedir(), '.babypanda', 'db', 'db.db');
const testDbFilePath = path.join(os.homedir(), '.babypanda', 'db', 'db.test.db');
const sqliteFilePath = process.env['IN_DEV_MODE'] === 'true' ? testDbFilePath : dbFilePath;

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'sqlite',
  dbCredentials: {
    url: `file://${sqliteFilePath}`,
  },
});
