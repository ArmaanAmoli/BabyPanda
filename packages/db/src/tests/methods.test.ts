import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { spawnSync } from 'child_process';
import {
  createSession,
  createMessage,
  addProvider,
  getMessages,
  addCompactionSummary,
  getCompactionSummaries,
  getMostRecentCompactionSummary,
  getMessagesAfterTimestamp,
  deleteSession,
  getSession,
} from '../methods';
import { and, desc, eq } from 'drizzle-orm';
import path from 'path';
import { db } from '../index.db';
import { Message, Session, CompactionResults } from '../db/schema';
import { Role } from '@baby-panda/types';
const rootDir = path.dirname(path.dirname(path.join(__dirname)));

const IN_DEV_MODE = process.env['IN_DEV_MODE'] == 'true' ? true : false;
if (!IN_DEV_MODE) {
  test.skip('Test only available in dev mode', () => {});
}

const migrationCommand = 'bunx drizzle-kit migrate';
const output = spawnSync(migrationCommand, { cwd: rootDir, shell: true });

if (output.error) {
  test.skip(`Can't perform test migration runtime error: 
        ${output.error.message.toString()} 
        ${output.error.cause ? 'caused by: ' + output.error.cause : ''}`, () => {});
}
if (output.stderr.toString().trim().length !== 0) {
  test.skip(`Can't perform test migration drizzle command failed: ${output.stderr.toString()}`, () => {});
}

type MessageArrayFromDB = Awaited<ReturnType<typeof getMessages>>;
type CompactionSummaryFromDB = Awaited<ReturnType<typeof getCompactionSummaries>>;

describe('Database methods test suite', () => {
  //create session;
  let newSessionId: string;
  let newSessionId2: string;
  beforeEach(async () => {
    newSessionId = await createSession();
    newSessionId2 = await createSession();
  });
  afterEach(async () => {
    await deleteSession(newSessionId);
    await deleteSession(newSessionId2);
  });
  test('create new session with unique sessionId', async () => {
    const newSession = await db.select().from(Session).where(eq(Session.id, newSessionId));
    expect(newSessionId).toBeDefined();
    expect(newSessionId2).not.toBe(newSessionId);
    expect(newSession).toHaveLength(1);
    expect(newSession[0]?.id).toBe(newSessionId);
  });

  describe('Messages creation test', () => {
    let creationTime: number;
    let messages: MessageArrayFromDB;
    let messageCount: { count: number | null }[];

    beforeEach(async () => {
      creationTime = await createMessage(newSessionId, 'this is a test message', Role.user, false);
      messages = await db
        .select()
        .from(Message)
        .where(and(eq(Message.createdAt, creationTime), eq(Message.sessionId, newSessionId)));

      messageCount = await db
        .select({ count: Session.messagesCount })
        .from(Session)
        .where(eq(Session.id, newSessionId));
    });

    test('message created must have a unique key (sessionId, timestamp)', () => {
      expect(messages.length === 1).toBe(true);
    });
    test('message created must not be undefined', () => {
      expect(messages[0] == undefined).toBe(false);
    });
    test('message count must incriment in session table', () => {
      expect(messageCount[0] && messageCount[0].count === 1).toBe(true);
    });

    describe('Tests for getting messages', () => {
      let messages: MessageArrayFromDB;
      let belongsToSameSession: boolean;
      let haveNullSessionId: boolean;
      beforeEach(async () => {
        belongsToSameSession = true;
        haveNullSessionId = false;
        messages = await getMessages(newSessionId);
        for (const msg of messages) {
          if (msg.sessionId == null) {
            haveNullSessionId = true;
          }
          if (msg.sessionId !== null && msg.sessionId !== newSessionId) {
            belongsToSameSession = false;
          }
        }
      });
      test('all messages must have non null sessionId', () => {
        expect(haveNullSessionId).toBe(false);
      });
      test('getMessages returns all the messages with same sessionId', () => {
        expect(belongsToSameSession).toBe(true);
      });
    });
  });

  describe('Testing for getting messages created after a timestamp', () => {
    let messagesAfterTS2: MessageArrayFromDB;
    let belongsToSameSession: boolean;
    let haveNullSessionId: boolean;
    let timeStampConditionVoilated: boolean;
    let timestampNull: boolean;
    beforeEach(async () => {
      belongsToSameSession = true;
      haveNullSessionId = false;
      timeStampConditionVoilated = false;
      timestampNull = false;
      const timestamp = Date.now();
      await createMessage(newSessionId2, 'this is a test message 2', Role.user, false);
      await createMessage(newSessionId, 'this is a test message 2', Role.user, false);
      await createMessage(newSessionId, 'this is a test message 3', Role.user, false);
      messagesAfterTS2 = await getMessagesAfterTimestamp(newSessionId, timestamp);

      for (const msg of messagesAfterTS2) {
        if (msg.createdAt == null) {
          timestampNull = true;
        }
        if (msg.sessionId == null) {
          haveNullSessionId = true;
        } else if (msg.sessionId !== null && msg.sessionId != newSessionId) {
          belongsToSameSession = false;
        } else if (msg.createdAt != null && msg.createdAt <= timestamp) {
          timeStampConditionVoilated = true;
        }
      }
    });
    //expect
    test('all messages must have non null sessionId', () => {
      expect(haveNullSessionId).toBe(false);
    });
    test('getMessages returns all the messages with same sessionId', () => {
      expect(belongsToSameSession).toBe(true);
    });
    test('all messages must have non null timestamp', () => {
      expect(timestampNull).toBe(false);
    });
    test('all messages are strictly created after the given timestamp', () => {
      expect(timeStampConditionVoilated).toBe(false);
      expect(messagesAfterTS2).toHaveLength(2);
    });
  });

  describe('Tests for getting and inserting compaction summary', () => {
    let creationTime: number;
    let compactionSummary: CompactionSummaryFromDB;

    beforeEach(async () => {
      creationTime = await addCompactionSummary(newSessionId, 'this is a test summary');
      compactionSummary = await db
        .select()
        .from(CompactionResults)
        .where(
          and(
            eq(CompactionResults.sessionId, newSessionId),
            eq(CompactionResults.createdAt, creationTime),
          ),
        );
    });

    describe('Add compaction summary', () => {
      test('creates a compaction summary', () => {
        expect(compactionSummary).toHaveLength(1);
        expect(compactionSummary[0]?.sessionId).toBe(newSessionId);
        expect(compactionSummary[0]?.createdAt).toBe(creationTime);
      });
    });

    describe('Get compaction summary', () => {
      let summary: CompactionSummaryFromDB;
      beforeEach(async () => {
        await addCompactionSummary(newSessionId, 'this is a test summary');
        await addCompactionSummary(newSessionId, 'this is a test summary');
        await addCompactionSummary(newSessionId, 'this is a test summary');
        await addCompactionSummary(newSessionId2, 'this is a test summary');
        summary = await getCompactionSummaries(newSessionId);
      });
      let haveNullSessionId = false;
      let isTimestampNull = false;
      let returnSummariesOfSameSession = true;

      test('returns summary with not null sessionId', () => {
        for (const s of summary) {
          if (s.sessionId == null) {
            haveNullSessionId = true;
            break;
          }
        }
        expect(haveNullSessionId).toBe(false);
      });

      test('returns summary of the same sessionId', () => {
        for (const s of summary) {
          if (s.sessionId) {
            if (s.sessionId !== newSessionId) {
              returnSummariesOfSameSession = false;
              break;
            }
          }
        }
        expect(returnSummariesOfSameSession).toBe(true);
      });

      test('timestamp is not null in all summary messages', () => {
        for (const s of summary) {
          if (s.createdAt == null) {
            isTimestampNull = true;
            break;
          }
        }
        expect(isTimestampNull).toBe(false);
      });
      test('returns summary sorted in ascending order with respect to timestamp they were created', () => {
        let isSorted = true;
        let lastTimestamp = 0;
        for (const s of summary) {
          if (lastTimestamp === 0) {
            lastTimestamp = s.createdAt!;
          } else {
            if (lastTimestamp >= s.createdAt!) {
              isSorted = false;
              break;
            }
            lastTimestamp = s.createdAt!;
          }
        }
        expect(isSorted).toBe(true);
      });
    });
  });

  test('delete session must delete all the messages in that session', async () => {
    await deleteSession(newSessionId);
    await deleteSession(newSessionId2);

    const sessionDeleted1 = (await getSession(newSessionId)).length === 0;
    const messagesDeleted1 = (await getMessages(newSessionId)).length === 0;
    const sessionDeleted2 = (await getSession(newSessionId2)).length === 0;
    const messagesDeleted2 = (await getMessages(newSessionId2)).length === 0;
    const sessionDeleted = sessionDeleted1 && sessionDeleted2;
    const messageDeleted = messagesDeleted1 && messagesDeleted2;
    expect(sessionDeleted).toBe(true);
    expect(messageDeleted).toBe(true);

    if (!sessionDeleted) {
      //manual cleanup
      await db.delete(Session).where(eq(Session.id, newSessionId));
      await db.delete(Session).where(eq(Session.id, newSessionId2));

      await db.delete(Message).where(eq(Message.sessionId, newSessionId));
      await db.delete(Message).where(eq(Message.sessionId, newSessionId2));

      await db.delete(CompactionResults).where(eq(CompactionResults.sessionId, newSessionId));
      await db.delete(CompactionResults).where(eq(CompactionResults.sessionId, newSessionId2));
    }
  });
});
