import { afterEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { runInFreshProcess, temporaryHome } from './isolatedDatabase';

const temporaryHomes: { home: string; dispose: () => void }[] = [];

afterEach(() => {
  for (const created of temporaryHomes.splice(0)) {
    created.dispose();
  }
});

describe('embedded migrations', () => {
  test('preserve web credential types and session history across processes', () => {
    const { home, dispose } = temporaryHome();
    temporaryHomes.push({ home, dispose });

    runInFreshProcess(
      home,
      `
        await database.runMigrations();
        const sessionId = await database.createSession();
        await database.createMessage(sessionId, JSON.stringify({role: 'user', content: 'hello'}), 'user');
        await database.addProvider({provider: 'Nvidia', endpoint: 'https://example.test', key: 'fake-nvidia-key', type: 'model'});
        await database.addProvider({provider: 'exa', endpoint: 'https://api.exa.ai', key: 'fake-exa-key', type: 'web'});
        console.log(JSON.stringify(sessionId));
        database.closeDatabase();
      `,
    ) as string;

    const restarted = runInFreshProcess(
      home,
      `
        await database.runMigrations();
        const sessions = await database.getSessions();
        const webKeys = await database.getWebApiKeys();
        const messages = await database.getMessages(sessions[0].id);
        console.log(JSON.stringify({webKeys, messageCount: messages.length}));
        database.closeDatabase();
      `,
    ) as {
      webKeys: { provider: string; endpoint: string; hasKey: string }[];
      messageCount: number;
    };

    expect(restarted.webKeys).toEqual([
      { provider: 'exa', endpoint: 'https://api.exa.ai', hasKey: 'fake-exa-key' },
    ]);
    expect(restarted.messageCount).toBe(1);
  });

  test('recover an Exa key whose type was reset by an older binary', () => {
    const { home, dispose } = temporaryHome();
    temporaryHomes.push({ home, dispose });
    const dbDirectory = path.join(home, '.babypanda', 'db');
    mkdirSync(dbDirectory, { recursive: true });
    const legacy = new Database(path.join(dbDirectory, 'db.db'));
    legacy.run(
      `CREATE TABLE api_keys (
        provider text NOT NULL,
        endpoint text NOT NULL,
        key text PRIMARY KEY,
        type text DEFAULT 'model' NOT NULL
      );`,
    );
    legacy
      .query(`INSERT INTO api_keys (provider, endpoint, key, type) VALUES (?, ?, ?, 'model');`)
      .run('exa', 'https://api.exa.ai', 'fake-exa-key');
    legacy.close();

    const webKeys = runInFreshProcess(
      home,
      `
        await database.runMigrations();
        console.log(JSON.stringify(await database.getWebApiKeys()));
        database.closeDatabase();
      `,
    ) as { provider: string; endpoint: string; hasKey: string }[];

    expect(webKeys).toEqual([
      { provider: 'exa', endpoint: 'https://api.exa.ai', hasKey: 'fake-exa-key' },
    ]);
  });

  test('session model settings are stored and restored across processes', () => {
    const { home, dispose } = temporaryHome();
    temporaryHomes.push({ home, dispose });

    const sessionId = runInFreshProcess(
      home,
      `
        await database.runMigrations();
        const id = await database.createSession();
        await database.updateSession(id, {
          provider: 'Nvidia',
          model: 'moonshotai/kimi-k3.1-pro',
          reasoningEffort: 'high',
        });
        console.log(JSON.stringify(id));
        database.closeDatabase();
      `,
    ) as string;

    const restored = runInFreshProcess(
      home,
      `
        await database.runMigrations();
        const [session] = await database.getSession(${JSON.stringify(sessionId)});
        console.log(
          JSON.stringify({
            provider: session.provider,
            model: session.model,
            reasoningEffort: session.reasoningEffort,
          }),
        );
        database.closeDatabase();
      `,
    ) as { provider: string; model: string; reasoningEffort: string };

    expect(restored).toEqual({
      provider: 'Nvidia',
      model: 'moonshotai/kimi-k3.1-pro',
      reasoningEffort: 'high',
    });
  });

  test('sessions created before the model settings columns exist read back as null', () => {
    const { home, dispose } = temporaryHome();
    temporaryHomes.push({ home, dispose });
    const dbDirectory = path.join(home, '.babypanda', 'db');
    mkdirSync(dbDirectory, { recursive: true });
    const legacy = new Database(path.join(dbDirectory, 'db.db'));
    legacy.run(
      `CREATE TABLE session (
        session_id text PRIMARY KEY,
        created_at integer NOT NULL,
        parent_session_id text,
        messages_count integer DEFAULT 0 NOT NULL,
        tokens_in_context_window integer DEFAULT 0 NOT NULL,
        project_directory text NOT NULL
      );`,
    );
    legacy
      .query(`INSERT INTO session (session_id, created_at, project_directory) VALUES (?, ?, ?);`)
      .run('01LEGACYSESSION', 1789950520329, '/tmp/legacy');
    legacy.close();

    const restored = runInFreshProcess(
      home,
      `
        await database.runMigrations();
        const [session] = await database.getSession('01LEGACYSESSION');
        console.log(
          JSON.stringify({
            provider: session.provider,
            model: session.model,
            reasoningEffort: session.reasoningEffort,
          }),
        );
        database.closeDatabase();
      `,
    ) as { provider: unknown; model: unknown; reasoningEffort: unknown };

    expect(restored).toEqual({ provider: null, model: null, reasoningEffort: null });
  });
});
