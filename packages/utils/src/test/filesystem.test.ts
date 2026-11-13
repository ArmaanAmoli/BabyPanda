import { describe, expect, test } from 'bun:test';
import { logError, cleanOldLogs } from '../writeLog';
import { LogType } from '@baby-panda/types';
import { existsSync, rmSync, utimesSync, writeFileSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';
import os from 'os';

const PROJECT = '__log_test__';
// Hermetic base dir: never touch the real ~/.babypanda/logs during tests.
const baseDir = path.join(os.tmpdir(), `babypanda-log-test-${process.pid}`);
const projectDir = path.join(baseDir, PROJECT);

const DAY = 24 * 60 * 60 * 1000;
function setAge(filePath: string, ageMs: number) {
  const t = new Date(Date.now() - ageMs);
  utimesSync(filePath, t, t);
}

describe('error logging', () => {
  test('writes one tagged single-line entry per session file', async () => {
    rmSync(projectDir, { recursive: true, force: true });
    await logError(
      LogType.agent,
      PROJECT,
      'sess1',
      'agent loop failed',
      new Error('boom'),
      baseDir,
    );

    const file = path.join(projectDir, 'sess1.log');
    expect(existsSync(file)).toBeTrue();
    const line = readFileSync(file, 'utf8').trim();
    expect(line).toMatch(/^\[agent\] \S+ ERROR: agent loop failed \| cause: Error: boom$/);
  });

  test('combines all log types into the same session file and creates no per-type files', async () => {
    rmSync(projectDir, { recursive: true, force: true });
    await logError(LogType.agent, PROJECT, 'sess2', 'agent failure', undefined, baseDir);
    await logError(LogType.mcp, PROJECT, 'sess2', 'mcp failure', new Error('tool down'), baseDir);

    const contents = readFileSync(path.join(projectDir, 'sess2.log'), 'utf8');
    expect(contents).toContain('[agent]');
    expect(contents).toContain('[mcp]');
    // No eager per-type files are created.
    expect(existsSync(path.join(projectDir, 'agent.log'))).toBeFalse();
    expect(existsSync(path.join(projectDir, 'mcp.log'))).toBeFalse();
  });

  test('flattens a multi-level cause chain onto one line', async () => {
    rmSync(projectDir, { recursive: true, force: true });
    const cause = new Error('outer', { cause: new Error('inner') });
    await logError(LogType.db, PROJECT, 'sess3', 'query failed', cause, baseDir);

    const line = readFileSync(path.join(projectDir, 'sess3.log'), 'utf8').trim();
    expect(line).toContain('cause: Error: outer <- caused by Error: inner');
    expect(line.split('\n').length).toBe(1);
  });
});

describe('log cleanup', () => {
  test('deletes sessions older than the TTL and preserves recent ones (both layouts)', async () => {
    rmSync(projectDir, { recursive: true, force: true });
    mkdirSync(projectDir, { recursive: true });

    // Current layout: single-file sessions.
    const staleNew = path.join(projectDir, 'stale-new.log');
    const freshNew = path.join(projectDir, 'fresh-new.log');
    writeFileSync(staleNew, 'x');
    writeFileSync(freshNew, 'x');
    setAge(staleNew, 8 * DAY);
    setAge(freshNew, 1 * DAY);

    // Legacy layout: per-session directories of per-type files.
    const staleLegacy = path.join(projectDir, 'stale-legacy');
    const freshLegacy = path.join(projectDir, 'fresh-legacy');
    mkdirSync(staleLegacy, { recursive: true });
    mkdirSync(freshLegacy, { recursive: true });
    writeFileSync(path.join(staleLegacy, 'agent.log'), 'x');
    writeFileSync(path.join(freshLegacy, 'agent.log'), 'x');
    setAge(path.join(staleLegacy, 'agent.log'), 8 * DAY);
    setAge(path.join(freshLegacy, 'agent.log'), 1 * DAY);

    await cleanOldLogs(7, baseDir);

    expect(existsSync(staleNew)).toBeFalse();
    expect(existsSync(freshNew)).toBeTrue();
    expect(existsSync(staleLegacy)).toBeFalse();
    expect(existsSync(freshLegacy)).toBeTrue();

    rmSync(projectDir, { recursive: true, force: true });
  });

  test('is a no-op when the logs directory does not exist', async () => {
    const missing = path.join(baseDir, 'does-not-exist');
    await expect(cleanOldLogs(7, missing)).resolves.toBeUndefined();
  });
});
