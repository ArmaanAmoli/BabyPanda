import dotenv from 'dotenv';
import path from 'path';

const envPath = path.join(__dirname, '.env');
dotenv.config({ path: envPath });

const ENV = {
  IN_DEV_MODE: process.env['IN_DEV_MODE'] ?? false,
};

export { ENV };
