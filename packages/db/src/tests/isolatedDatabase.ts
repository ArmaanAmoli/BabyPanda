import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Runs database code in a throwaway process with its own `HOME`.
 *
 * The database module resolves its file from `HOME` at import time, so a
 * separate process is the only way to exercise a fresh database — and to
 * prove that what one process writes, the next one reads back.
 */
export function runInFreshProcess<T>(home: string, body: string): T {
  const repoRoot = path.resolve(import.meta.dir, '../../../..');
  const dbModule = pathToFileURL(path.join(repoRoot, 'packages/db/src/index.ts')).href;
  const source = `
    import * as database from ${JSON.stringify(dbModule)};
    ${body}
  `;
  const result = Bun.spawnSync({
    cmd: [process.execPath, '-e', source],
    cwd: repoRoot,
    env: { ...process.env, HOME: home, IN_DEV_MODE: 'false' },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  expect(result.exitCode, result.stderr.toString()).toBe(0);
  const output = result.stdout.toString().trim();
  return (output ? (JSON.parse(output) as T) : undefined) as T;
}

/** A temporary home directory plus the call that removes it again. */
export function temporaryHome(): { home: string; dispose: () => void } {
  const home = mkdtempSync(path.join(tmpdir(), 'babypanda-db-'));
  return {
    home,
    dispose: () => rmSync(home, { recursive: true, force: true }),
  };
}
