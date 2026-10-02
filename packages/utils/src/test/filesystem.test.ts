import { describe, expect, test } from 'bun:test';
import { writeLogs } from '../writeLog';
import { LogType } from '@baby-panda/types';

describe('Filesystem tools test', () => {
  test('Should be able to write logs in .babyPanda directory', () => {
    expect(() =>
      writeLogs(LogType.agent, 'test', 'test', 'This log file is for testing')
    ).not.toThrow();
  });
});
