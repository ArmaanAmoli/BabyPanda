import { db } from './index.db';
import { Session, Message, ApiKeys } from './db/schema';
import { Role } from '@baby-panda/types';
import { asc, desc, eq, and, ne, gt, gte } from 'drizzle-orm';
import { ulid } from 'ulid';
interface APIProvider {
  provider: string;
  endpoint: string;
  key: string;
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

// function isSqliteError(error: unknown): error is SqliteError {
//   if (!(error instanceof Error)) {
//     return false;
//   }

//   if ('code' in error || 'rawCode' in error) {
//     return true;
//   }

//   return error.cause !== undefined && isSqliteError(error.cause);
// }
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

export async function createSession(parentSessionId?: string) {
  const id: string = ulid();
  const cwd = process.cwd();
  await db
    .insert(Session)
    .values(
      parentSessionId
        ? { id, parentSessionId, projectDirectory: cwd }
        : { id, projectDirectory: cwd },
    );
  return id;
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
        })
        .where(eq(ApiKeys.provider, existing.provider));
    } else {
      await db.delete(ApiKeys).where(eq(ApiKeys.key, details.key));
      await db.insert(ApiKeys).values({
        provider: details.provider,
        endpoint: details.endpoint,
        key: details.key,
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
    })
    .from(ApiKeys);
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
export async function updateSession(sessionId: string, updatedValue: { messagesCount: number }) {
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
