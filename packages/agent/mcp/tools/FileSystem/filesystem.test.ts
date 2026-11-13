import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import { grep } from './filesystem';

// Hermetic fixture: never search the real repository from these tests.
const root = path.join(os.tmpdir(), `babypanda-grep-test-${process.pid}`);
const nested = path.join(root, 'nested');
const ignored = path.join(root, 'node_modules');
const fileA = path.join(root, 'a.txt');
const fileMany = path.join(root, 'many.txt');

beforeAll(() => {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(nested, { recursive: true });
  mkdirSync(ignored, { recursive: true });
  writeFileSync(fileA, 'alpha\nBETA\ngamma\n');
  writeFileSync(path.join(nested, 'b.txt'), 'delta alpha\nnothing\n');
  writeFileSync(path.join(ignored, 'c.txt'), 'alpha inside node_modules\n');
  writeFileSync(path.join(root, 'dash.txt'), '-foo bar\nfoo bar\n');
  writeFileSync(
    fileMany,
    Array.from({ length: 400 }, (_, i) => `match line ${i}`).join('\n') + '\n',
  );
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('grep tool', () => {
  test('searches a directory recursively and reports line numbers', async () => {
    const result = await grep(root, 'alpha');

    expect(result.exitCode).toBe(0);
    expect(result.matches).toBe(2);
    expect(result.truncated).toBeFalse();
    expect(result.stdout).toContain('a.txt:1:alpha');
    expect(result.stdout).toContain('nested/b.txt:1:delta alpha');
  });

  test('searches a single file', async () => {
    const result = await grep(fileA, 'gamma');

    expect(result.exitCode).toBe(0);
    expect(result.matches).toBe(1);
    expect(result.stdout).toContain('a.txt:3:gamma');
  });

  test('accepts a flag with or without a leading dash', async () => {
    const bare = await grep(root, 'beta', 'i');
    const dashed = await grep(root, 'beta', '-i');

    expect(bare.exitCode).toBe(0);
    expect(bare.matches).toBe(1);
    expect(bare.stdout).toContain('a.txt:2:BETA');
    // The old implementation passed the flag through verbatim, so `i` became
    // the pattern and the real pattern became a filename.
    expect(dashed.stdout).toBe(bare.stdout);
  });

  test('rejects flags outside the allow-list instead of spawning them', async () => {
    await expect(grep(root, 'alpha', '--color=always')).rejects.toThrow(/unsupported grep flag/);
    await expect(grep(root, 'alpha', 'r')).rejects.toThrow(/unsupported grep flag/);
  });

  test('skips excluded directories unless the target is inside one', async () => {
    const fromRoot = await grep(root, 'alpha');
    expect(fromRoot.stdout).not.toContain('node_modules');

    const fromInside = await grep(ignored, 'alpha');
    expect(fromInside.exitCode).toBe(0);
    expect(fromInside.matches).toBe(1);
    expect(fromInside.stdout).toContain('c.txt:1:alpha inside node_modules');
  });

  test('treats "no matches" as exit code 1, not an error', async () => {
    const result = await grep(root, 'definitely-not-present');

    expect(result.exitCode).toBe(1);
    expect(result.matches).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.truncated).toBeFalse();
  });

  test('reports a bad pattern as exit code 2 with stderr', async () => {
    const result = await grep(root, '[');

    expect(result.exitCode).toBe(2);
    expect(result.stderr.length).toBeGreaterThan(0);
  });

  test('does not read a pattern starting with a dash as an option', async () => {
    const result = await grep(root, '^-foo');

    expect(result.exitCode).toBe(0);
    expect(result.matches).toBe(1);
    expect(result.stdout).toContain('dash.txt:1:-foo bar');
  });

  test('caps the output and flags it as truncated', async () => {
    const result = await grep(root, '^match line');

    expect(result.truncated).toBeTrue();
    expect(result.matches).toBeGreaterThan(0);
    expect(result.matches).toBeLessThan(400);
    expect(result.stderr).toContain('grep stopped');
  });
});
