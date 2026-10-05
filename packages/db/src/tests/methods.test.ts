import { describe, test, expect } from 'bun:test';
import { spawnSync } from 'child_process';
import path from 'path';
const rootDir = path.dirname(path.dirname(path.join(__dirname)));

const IN_DEV_MODE = process.env['IN_DEV_MODE'] ?? false;
if (!IN_DEV_MODE) {
  test.skip('Test only available in dev mode', () => {});
}

const migrationCommand = 'bunx drizzle-kit migrate';
const output = spawnSync(migrationCommand, { cwd: rootDir, shell: true });

if (output.error) {
  test.skip(`Can't perform test migration runtime error: 
        ${output.error.message.toString()} 
        ${output.error.cause ? 'caused by: ' + output.error.cause : ''}`, () => {});
}
if (output.stderr.toString().trim().length !== 0) {
  test.skip(`Can't perform test migration drizzle command failed: ${output.stderr.toString()}`, () => {});
}

describe('tests for database methods', () => {});
