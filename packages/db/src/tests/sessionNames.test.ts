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

/** Every session of the temporary database, as `{id, name}` pairs. */
function readNames(home: string) {
  return runInFreshProcess<{ id: string; name: string }[]>(
    home,
    `
      await database.runMigrations();
      const sessions = await database.getSessions();
      console.log(JSON.stringify(sessions.map(session => ({id: session.id, name: session.name}))));
      database.closeDatabase();
    `,
  );
}

describe('session names', () => {
  test('a new session is labelled untitled-<n>, numbered per directory', () => {
    const { home, dispose } = temporaryHome();
    temporaryHomes.push({ home, dispose });

    const names = runInFreshProcess<{ first: string; second: string; third: string }>(
      home,
      `
        await database.runMigrations();
        const first = await database.createSession();
        const second = await database.createSession();
        // a session in another directory must not consume this one's numbers
        process.chdir('/tmp');
        const third = await database.createSession();
        process.chdir(${JSON.stringify(process.cwd())});
        console.log(JSON.stringify({first, second, third}));
        database.closeDatabase();
      `,
    );

    expect(names).toBeDefined();
    const rows = readNames(home);
    const byId = new Map(rows.map((row) => [row.id, row.name]));
    expect(byId.get(names.first)).toBe('untitled-1');
    expect(byId.get(names.second)).toBe('untitled-2');
    expect(byId.get(names.third)).toBe('untitled-1');
  });

  test('a number freed by a rename is handed out again', () => {
    const { home, dispose } = temporaryHome();
    temporaryHomes.push({ home, dispose });

    const ids = runInFreshProcess<{ first: string; second: string; third: string }>(
      home,
      `
        await database.runMigrations();
        const first = await database.createSession();
        const second = await database.createSession();
        await database.renameSession(first, 'refactor auth');
        const third = await database.createSession();
        console.log(JSON.stringify({first, second, third}));
        database.closeDatabase();
      `,
    );

    const byId = new Map(readNames(home).map((row) => [row.id, row.name]));
    expect(byId.get(ids.first)).toBe('refactor auth');
    expect(byId.get(ids.second)).toBe('untitled-2');
    // untitled-1 is free again, so the newest session takes it rather than
    // climbing to untitled-3
    expect(byId.get(ids.third)).toBe('untitled-1');
  });

  test('renaming keeps the label unique inside the directory', () => {
    const { home, dispose } = temporaryHome();
    temporaryHomes.push({ home, dispose });

    const ids = runInFreshProcess<{
      first: string;
      second: string;
      taken: unknown;
      clash: unknown;
      own: unknown;
    }>(
      home,
      `
        await database.runMigrations();
        const first = await database.createSession();
        const second = await database.createSession();
        const taken = await database.renameSession(first, 'shared');
        const clash = await database.renameSession(second, 'shared');
        const own = await database.renameSession(first, 'shared');
        console.log(JSON.stringify({first, second, taken, clash, own}));
        database.closeDatabase();
      `,
    );

    expect(ids.taken).toEqual({ ok: true, name: 'shared' });
    expect(ids.clash).toEqual({ ok: false, reason: 'name-taken' });
    // renaming to the name it already carries is not a clash
    expect(ids.own).toEqual({ ok: true, name: 'shared' });
  });

  test('an unusable or unknown rename is reported, not written', () => {
    const { home, dispose } = temporaryHome();
    temporaryHomes.push({ home, dispose });

    const results = runInFreshProcess<Record<string, unknown>>(
      home,
      `
        await database.runMigrations();
        const id = await database.createSession();
        const empty = await database.renameSession(id, '   ');
        const long = await database.renameSession(id, 'a'.repeat(65));
        const control = await database.renameSession(id, 'two\\nlines');
        const missing = await database.renameSession('01NOSUCHSESSION', 'fine');
        console.log(JSON.stringify({empty, long, control, missing}));
        database.closeDatabase();
      `,
    );

    expect(results.empty).toEqual({ ok: false, reason: 'invalid-name' });
    expect(results.long).toEqual({ ok: false, reason: 'invalid-name' });
    expect(results.control).toEqual({ ok: false, reason: 'invalid-name' });
    expect(results.missing).toEqual({ ok: false, reason: 'not-found' });
    expect(readNames(home)[0]?.name).toBe('untitled-1');
  });

  test('a name survives a restart and is read back by id', () => {
    const { home, dispose } = temporaryHome();
    temporaryHomes.push({ home, dispose });

    const sessionId = runInFreshProcess<string>(
      home,
      `
        await database.runMigrations();
        const id = await database.createSession();
        await database.renameSession(id, '  persisted name  ');
        console.log(JSON.stringify(id));
        database.closeDatabase();
      `,
    );

    const restored = runInFreshProcess<{ name: string | null; missing: string | null }>(
      home,
      `
        await database.runMigrations();
        console.log(JSON.stringify({
          name: await database.getSessionName(${JSON.stringify(sessionId)}),
          missing: await database.getSessionName('01NOSUCHSESSION'),
        }));
        database.closeDatabase();
      `,
    );

    expect(restored.name).toBe('persisted name');
    expect(restored.missing).toBeNull();
  });

  test('sessions created before the column existed are numbered on migration', () => {
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
    const insert = legacy.query(
      `INSERT INTO session (session_id, created_at, project_directory) VALUES (?, ?, ?);`,
    );
    insert.run('01OLDER', 100, '/tmp/legacy');
    insert.run('01NEWER', 200, '/tmp/legacy');
    insert.run('01OTHER', 150, '/tmp/other');
    legacy.close();

    const rows = readNames(home);
    const byId = new Map(rows.map((row) => [row.id, row.name]));
    expect(byId.get('01OLDER')).toBe('untitled-1');
    expect(byId.get('01NEWER')).toBe('untitled-2');
    // numbering is per directory, so the other project starts again at one
    expect(byId.get('01OTHER')).toBe('untitled-1');
  });
});
