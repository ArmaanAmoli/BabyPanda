import { describe, expect, test } from 'bun:test';
import { writeLogs } from '../writeLog';
import { LogType } from '@baby-panda/types';
import { existsSync, rmSync } from 'fs';
import path from 'path';
import os from 'os';

describe('logging system test', () => {
  test('should be able to write logs in .babyPanda directory', () => {
    expect(() =>
      writeLogs(LogType.agent, 'test', 'test', 'This log file is for testing'),
    ).not.toThrow();
  });
  test('logs folder should exists', () => {
    const logDirPath = path.join(os.homedir(), '.babypanda', 'logs', 'test', 'test');
    const directory_created = existsSync(logDirPath);
    expect(directory_created).toBe(true);
  });
  test('logs should only be written inside /.babypanda/logs folder', () => {
    const logDirPath = path.join(os.homedir(), '.babypanda', 'logs', 'test', 'test');
    rmSync(logDirPath, { recursive: true, force: true });
    writeLogs(LogType.agent, 'test', 'test', 'This log file is for testing');
    const directory_created = existsSync(logDirPath);
    expect(directory_created).toBeTrue();
  });
});
