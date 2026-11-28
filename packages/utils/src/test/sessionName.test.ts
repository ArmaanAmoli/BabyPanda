import { describe, expect, test } from 'bun:test';
import {
  MAX_SESSION_NAME_LENGTH,
  UNTITLED_SESSION_NAME_PREFIX,
  formatUntitledSessionName,
  normalizeSessionName,
  untitledSessionNameNumber,
} from '../sessionName';

describe('formatUntitledSessionName', () => {
  test('prefixes the number', () => {
    expect(formatUntitledSessionName(1)).toBe('untitled-1');
    expect(formatUntitledSessionName(42)).toBe('untitled-42');
  });

  test('round-trips through untitledSessionNameNumber', () => {
    for (const number of [1, 2, 9, 10, 1234]) {
      expect(untitledSessionNameNumber(formatUntitledSessionName(number))).toBe(number);
    }
  });
});

describe('untitledSessionNameNumber', () => {
  test('reads the number out of an untitled label', () => {
    expect(untitledSessionNameNumber('untitled-7')).toBe(7);
  });

  test('anything else has no number', () => {
    expect(untitledSessionNameNumber('untitled-')).toBeNull();
    expect(untitledSessionNameNumber('untitled-07a')).toBeNull();
    expect(untitledSessionNameNumber('untitled--3')).toBeNull();
    expect(untitledSessionNameNumber('my-untitled-3')).toBeNull();
    expect(untitledSessionNameNumber('refactor-auth')).toBeNull();
    expect(untitledSessionNameNumber(UNTITLED_SESSION_NAME_PREFIX)).toBeNull();
  });
});

describe('normalizeSessionName', () => {
  test('keeps a name as written apart from surrounding whitespace', () => {
    expect(normalizeSessionName('  refactor auth  ')).toBe('refactor auth');
    expect(normalizeSessionName('fix: /api v2 — retries')).toBe('fix: /api v2 — retries');
  });

  test('rejects a name with nothing in it', () => {
    expect(normalizeSessionName('')).toBeNull();
    expect(normalizeSessionName('   ')).toBeNull();
    expect(normalizeSessionName('\t\n')).toBeNull();
  });

  test('rejects a name past the length limit', () => {
    expect(normalizeSessionName('a'.repeat(MAX_SESSION_NAME_LENGTH))).toBe(
      'a'.repeat(MAX_SESSION_NAME_LENGTH),
    );
    expect(normalizeSessionName('a'.repeat(MAX_SESSION_NAME_LENGTH + 1))).toBeNull();
  });

  test('rejects control characters', () => {
    expect(normalizeSessionName('two\nlines')).toBeNull();
    expect(normalizeSessionName('bell\u0007here')).toBeNull();
    expect(normalizeSessionName('tab\there')).toBeNull();
  });
});
