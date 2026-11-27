import { db } from './index.db';
import { Session, Message, ApiKeys } from './db/schema';
import { Role, type ApiKeyType, type ReasoningEffort } from '@baby-panda/types';
import {
  formatUntitledSessionName,
  normalizeSessionName,
  untitledSessionNameNumber,
} from '@baby-panda/utils';
import { asc, desc, eq, and, ne, gt, gte } from 'drizzle-orm';
import { ulid } from 'ulid';
interface APIProvider {
  provider: string;
  endpoint: string;
  key: string;
  type: ApiKeyType;
}

type SqliteError = Error & {
  code?: string;
  rawCode?: number;
};

function findSqliteError(error: unknown): SqliteError | undefined {
  let current: unknown = error;
  while (current instanceof Error) {
    const err = current as SqliteError & { cause?: unknown };
    if (err.code != undefined || err.rawCode !== undefined) {
      return err;
    }
    current = err.cause;
  }
  return undefined;
}

/** True when SQLite rejected a write because a unique index already matched. */
function isUniqueViolation(error: unknown): boolean {
  const sqliteError = findSqliteError(error);
  return sqliteError?.code === 'SQLITE_CONSTRAINT_UNIQUE' || sqliteError?.rawCode === 2067;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function SQLSafeExecutor<TArgs extends readonly unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  args: TArgs,
  retry: number = 3,
): Promise<TResult> {
  try {
    const output = await fn(...args);
    return output;
  } catch (err: unknown) {
    const sqliteError = findSqliteError(err);
    if (sqliteError && (sqliteError.code === 'SQLITE_BUSY' || sqliteError.rawCode === 5)) {
      // attempt retry
      if (retry > 0) {
        await delay(5000);
        return await SQLSafeExecutor(fn, args, retry - 1);
      } else {
        throw err;
      }
    }
    throw err;
  }
}

/**
 * Smallest `untitled-<n>` number not yet taken in this project directory.
 *
 * Numbers freed by a rename or a deletion are handed out again, so a folder
 * that only ever renames its sessions never climbs without bound.
 */
async function nextUntitledNumber(projectDirectory: string): Promise<number> {
  const rows = await db
    .select({ name: Session.name })
    .from(Session)
    .where(eq(Session.projectDirectory, projectDirectory));
  const taken = new Set<number>();
  for (const row of rows) {
    const number = untitledSessionNameNumber(row.name);
    if (number !== null) {
      taken.add(number);
    }
  }
  let candidate = 1;
  while (taken.has(candidate)) {
    candidate += 1;
  }
  return candidate;
}

export async function createSession(parentSessionId?: string) {
  const id: string = ulid();
  const cwd = process.cwd();
  // A label is unique per project directory, so two processes starting a
  // session in the same folder can pick the same number. The unique index
  // rejects the loser, which then retries with the next free one.
  for (let attempt = 0; ; attempt += 1) {
    const name = formatUntitledSessionName(await nextUntitledNumber(cwd));
    try {
      await db
        .insert(Session)
        .values(
          parentSessionId
            ? { id, parentSessionId, projectDirectory: cwd, name }
            : { id, projectDirectory: cwd, name },
        );
      return id;
    } catch (error) {
      if (attempt >= 2 || !isUniqueViolation(error)) {
        throw error;
      }
    }
  }
}

export async function createMessage(sessionId: string, content: string, role: Role) {
  const creationTime = Date.now();
  db.transaction(
    (tx) => {
      const session = tx
        .select({
          messageCount: Session.messagesCount,
        })
        .from(Session)
        .where(eq(Session.id, sessionId))
        .all();
      // console.log(`session:`, session);
      if (!session[0] || session[0].messageCount === null) {
        tx.rollback();
        throw new Error(`Unable to find Session`);
      }
      const messageIndex = session[0].messageCount;
      tx.insert(Message)
        .values({
          id: ulid(),
          sessionId: sessionId,
          content: content,
          role: role,
          sequence: messageIndex,
        } as typeof Message.$inferInsert)
        .run();

      tx.update(Session)
        .set({ messagesCount: messageIndex + 1 })
        .where(eq(Session.id, sessionId))
        .run();
    },
    { behavior: 'immediate' },
  );
  return creationTime;
}

export async function addProvider(details: APIProvider) {
  try {
    const providers = await db.select().from(ApiKeys);
    const existing = providers.find(
      (provider) =>
        provider.provider !== null &&
        provider.provider?.toLowerCase() === details.provider.toLowerCase(),
    );

    if (existing?.provider) {
      await db
        .delete(ApiKeys)
        .where(and(eq(ApiKeys.key, details.key), ne(ApiKeys.provider, existing.provider)));
      await db
        .update(ApiKeys)
        .set({
          provider: details.provider,
          endpoint: details.endpoint,
          key: details.key,
          type: details.type,
        })
        .where(eq(ApiKeys.provider, existing.provider));
    } else {
      await db.delete(ApiKeys).where(eq(ApiKeys.key, details.key));
      await db.insert(ApiKeys).values({
        provider: details.provider,
        endpoint: details.endpoint,
        key: details.key,
        type: details.type,
      });
    }
    return true;
  } catch (err) {
    throw new Error(`Error occred while adding provider`, { cause: err });
  }
}
export async function getProviders() {
  return db
    .select({
      provider: ApiKeys.provider,
      endpoint: ApiKeys.endpoint,
      hasKey: ApiKeys.key,
      type: ApiKeys.type,
    })
    .from(ApiKeys);
}

/** Credentials for web-facing tools (Exa today), independent of chat providers. */
export async function getWebApiKeys() {
  return db
    .select({
      provider: ApiKeys.provider,
      endpoint: ApiKeys.endpoint,
      hasKey: ApiKeys.key,
    })
    .from(ApiKeys)
    .where(eq(ApiKeys.type, 'web'));
}
export async function getMessages(sessionId: string, index: number = 0) {
  const messages = await db
    .select()
    .from(Message)
    .where(
      and(
        eq(Message.sessionId, sessionId),
        ne(Message.role, Role.system),
        gte(Message.sequence, index),
      ),
    )
    .orderBy(asc(Message.sequence));
  return messages;
}
export async function getSessions() {
  const sessions = await db.select().from(Session);
  return sessions;
}
// `undefined` fields are skipped by drizzle, so callers may update any
// subset of the columns (e.g. only the model settings).
export async function updateSession(
  sessionId: string,
  updatedValue: {
    messagesCount?: number;
    provider?: string;
    model?: string;
    reasoningEffort?: ReasoningEffort;
  },
) {
  await db.update(Session).set(updatedValue).where(eq(Session.id, sessionId));
}
export async function getSession(sessionId: string) {
  const session = await db.select().from(Session).where(eq(Session.id, sessionId));
  return session;
}
export async function getSessionsByProjectDirectory(projectDirectory: string) {
  const sessions = await db
    .select()
    .from(Session)
    .where(eq(Session.projectDirectory, projectDirectory));
  return sessions;
}

/**
 * Why a rename did not happen. Reported rather than thrown, because every
 * case here is something the user typed and can correct.
 */
export type RenameSessionFailure = 'not-found' | 'invalid-name' | 'name-taken';

export type RenameSessionResult =
  { ok: true; name: string } | { ok: false; reason: RenameSessionFailure };

/**
 * Renames a session, keeping the label unique inside its project directory.
 *
 * The uniqueness check is a read, so the unique index stays the real guard:
 * two simultaneous renames to the same label still leave exactly one winner.
 */
export async function renameSession(
  sessionId: string,
  rawName: string,
): Promise<RenameSessionResult> {
  const name = normalizeSessionName(rawName);
  if (name === null) {
    return { ok: false, reason: 'invalid-name' };
  }
  const [session] = await db
    .select({ projectDirectory: Session.projectDirectory })
    .from(Session)
    .where(eq(Session.id, sessionId));
  if (!session) {
    return { ok: false, reason: 'not-found' };
  }
  const [clash] = await db
    .select({ id: Session.id })
    .from(Session)
    .where(and(eq(Session.projectDirectory, session.projectDirectory), eq(Session.name, name)));
  if (clash && clash.id !== sessionId) {
    return { ok: false, reason: 'name-taken' };
  }
  await db.update(Session).set({ name }).where(eq(Session.id, sessionId));
  return { ok: true, name };
}

/** The label of a session, or `null` when no such session exists. */
export async function getSessionName(sessionId: string): Promise<string | null> {
  const [session] = await db
    .select({ name: Session.name })
    .from(Session)
    .where(eq(Session.id, sessionId));
  return session?.name ?? null;
}

export async function getCompactionSummaries(sessionId: string) {
  const summaries = await db
    .select()
    .from(Message)
    .where(and(eq(Message.sessionId, sessionId), eq(Message.role, Role.compaction)))
    .orderBy(asc(Message.sequence));
  return summaries;
}
export async function getMostRecentCompactionSummary(sessionId: string) {
  const [summary] = await db
    .select()
    .from(Message)
    .where(and(eq(Message.sessionId, sessionId), eq(Message.role, Role.compaction)))
    .orderBy(desc(Message.sequence))
    .limit(1);
  return summary;
}

export async function deleteSession(sessionId: string) {
  await db.delete(Session).where(eq(Session.id, sessionId));
}

export async function getMessagesForSummary(sessionId: string, index: number = 0) {
  // role='skill' rows are user-injected skill content: they are never
  // summarized away and keep their position in the history, so compaction
  // skips them here (readSkill results stay role='tool' and compact normally).
  return await db
    .select()
    .from(Message)
    .where(
      and(
        eq(Message.sessionId, sessionId),
        gt(Message.sequence, index),
        ne(Message.role, Role.skill),
      ),
    )
    .orderBy(Message.sequence);
}

export function closeDatabase() {
  db.$client.close();
}
