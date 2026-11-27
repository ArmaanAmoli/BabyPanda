import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const repoRoot = path.resolve(import.meta.dir, '../../../..');
const dbModule = pathToFileURL(path.join(repoRoot, 'packages/db/src/index.ts')).href;
const temporaryHomes: string[] = [];

function runInFreshProcess(home: string, body: string) {
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
  return output ? (JSON.parse(output) as unknown) : undefined;
}

afterEach(() => {
  for (const home of temporaryHomes.splice(0)) {
    rmSync(home, { recursive: true, force: true });
  }
});

describe('changing saved api keys', () => {
  test('re-saving a model provider key replaces the stored row', () => {
    const home = mkdtempSync(path.join(tmpdir(), 'babypanda-apikeys-'));
    temporaryHomes.push(home);

    const providers = runInFreshProcess(
      home,
      `
        await database.runMigrations();
        await database.addProvider({provider: 'Nvidia', endpoint: 'https://example.test', key: 'old-nvidia-key', type: 'model'});
        await database.addProvider({provider: 'Nvidia', endpoint: 'https://example.test', key: 'new-nvidia-key', type: 'model'});
        console.log(JSON.stringify(await database.getProviders()));
        database.closeDatabase();
      `,
    ) as { provider: string; endpoint: string; hasKey: string; type: string }[];

    expect(providers).toEqual([
      {
        provider: 'Nvidia',
        endpoint: 'https://example.test',
        hasKey: 'new-nvidia-key',
        type: 'model',
      },
    ]);
  });

  test('re-saving the Exa web key replaces the stored row and leaves model keys alone', () => {
    const home = mkdtempSync(path.join(tmpdir(), 'babypanda-apikeys-'));
    temporaryHomes.push(home);

    const result = runInFreshProcess(
      home,
      `
        await database.runMigrations();
        await database.addProvider({provider: 'Nvidia', endpoint: 'https://example.test', key: 'fake-nvidia-key', type: 'model'});
        await database.addProvider({provider: 'exa', endpoint: 'https://api.exa.ai', key: 'old-exa-key', type: 'web'});
        await database.addProvider({provider: 'exa', endpoint: 'https://api.exa.ai', key: 'new-exa-key', type: 'web'});
        const webKeys = await database.getWebApiKeys();
        const modelKeys = (await database.getProviders()).filter(row => row.type === 'model');
        console.log(JSON.stringify({webKeys, modelKeys}));
        database.closeDatabase();
      `,
    ) as {
      webKeys: { provider: string; endpoint: string; hasKey: string }[];
      modelKeys: { provider: string; endpoint: string; hasKey: string; type: string }[];
    };

    expect(result.webKeys).toEqual([
      { provider: 'exa', endpoint: 'https://api.exa.ai', hasKey: 'new-exa-key' },
    ]);
    expect(result.modelKeys).toEqual([
      {
        provider: 'Nvidia',
        endpoint: 'https://example.test',
        hasKey: 'fake-nvidia-key',
        type: 'model',
      },
    ]);
  });
});
