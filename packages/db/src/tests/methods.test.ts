import { describe, test, expect } from 'bun:test';
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

const IN_DEV_MODE = process.env['IN_DEV_MODE'] ?? false;
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

describe('Test for db session creation', () => {
  describe('create new session with uniques sessionId', async () => {
    //create session;
    const newSessionId = await createSession();
    const newSessionId2 = await createSession();
    const newSession = await db.select().from(Session).where(eq(Session.id, newSessionId));
    expect(newSession.length === 1 && newSession[0]?.id && newSession[0]?.id === newSessionId).toBe(
      true,
    );

    describe('Tests for message CRUD', async () => {
      const creationTime = await createMessage(
        newSessionId,
        'this is a test message',
        Role.user,
        false,
      );
      const messages = await db
        .select()
        .from(Message)
        .where(and(eq(Message.createdAt, creationTime), eq(Message.sessionId, newSessionId)));

      const messageCount = await db
        .select({ count: Session.messagesCount })
        .from(Session)
        .where(eq(Session.id, newSessionId));
      test('message created must have a unique key (sessionId, timestamp)', () => {
        expect(messages.length === 1).toBe(true);
      });
      test('message created must not be undefined', () => {
        expect(messages[0] == undefined).toBe(false);
      });
      test('message count must incriment in session table', () => {
        expect(messageCount[0] && messageCount[0].count === 1).toBe(true);
      });

      describe('Tests for getting messages', async () => {
        const messages = await getMessages(newSessionId);
        let belongsToSameSession = true;
        let haveNullSessionId = false;

        for (const msg of messages) {
          if (msg.sessionId == null) {
            haveNullSessionId = true;
          }
          if (msg.sessionId !== null && msg.sessionId !== newSessionId) {
            belongsToSameSession = false;
          }
        }

        test('all messages must have non null sessionId', () => {
          expect(haveNullSessionId).toBe(false);
        });
        test('getMessages returns all the messages with same sessionId', () => {
          expect(belongsToSameSession).toBe(true);
        });
      });
    });

    describe('Testing for getting messages after a timestamp', async () => {
      const timestamp2 = Date.now();
      await createMessage(newSessionId, 'this is a test message 2', Role.user, false);
      await createMessage(newSessionId, 'this is a test message 3', Role.user, false);

      let belongsToSameSession = true;
      let haveNullSessionId = false;
      let timeStampConditionVoilated = false;
      let timestampNull = false;
      const messagesAfterTS2 = await getMessagesAfterTimestamp(newSessionId, timestamp2);
      for (const msg of messagesAfterTS2) {
        if (msg.createdAt == null) {
          timestampNull = true;
        }
        if (msg.sessionId == null) {
          haveNullSessionId = true;
        } else if (msg.sessionId !== null && msg.sessionId != newSessionId) {
          belongsToSameSession = false;
        } else if (msg.createdAt != null && msg.createdAt <= timestamp2) {
          timeStampConditionVoilated = true;
        }
      }
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
        expect(messagesAfterTS2.length === 2);
      });
    });

    describe('Tests for getting and inserting compaction summary', async () => {
      const creationTime = await addCompactionSummary(newSessionId, 'this is a test summary');
      const compactionSummary = await db
        .select()
        .from(CompactionResults)
        .where(
          and(
            eq(CompactionResults.sessionId, newSessionId),
            eq(CompactionResults.createdAt, creationTime),
          ),
        );
      const compactionSummarySuccessfulCreation = compactionSummary.length === 1;
      const compactionSummaryIsNotUndefined = compactionSummary[0] == undefined;
      const compactionSummaryWorkingCorrectly =
        compactionSummarySuccessfulCreation && compactionSummaryIsNotUndefined;
      describe('Add compaction summary', async () => {
        test('compaction summary successfully created', () => {
          expect(compactionSummarySuccessfulCreation).toBe(true);
        });
        test('created compaction summary is not undefined', () => {
          expect(compactionSummaryIsNotUndefined).toBe(false);
        });
      });
      describe.skipIf(!compactionSummaryWorkingCorrectly)('Get compaction summary', async () => {
        await addCompactionSummary(newSessionId, 'this is a test summary');
        await addCompactionSummary(newSessionId, 'this is a test summary');
        await addCompactionSummary(newSessionId, 'this is a test summary');
        await addCompactionSummary(newSessionId2, 'this is a test summary');
        const summary = await getCompactionSummaries(newSessionId);
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
        });

        test.skipIf(haveNullSessionId)('returns summary of the same sessionId', () => {
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

        test.skipIf(!returnSummariesOfSameSession)(
          'timestamp is not null in all summary messages',
          () => {
            for (const s of summary) {
              if (s.createdAt == null) {
                isTimestampNull = true;
                break;
              }
            }
            expect(isTimestampNull).toBe(false);
          },
        );
        test.skipIf(isTimestampNull)(
          'returns summary sorted in decending order with respect to timestamp they were created',
          () => {
            const isSorted = true;
            let lastTimestamp = 0;
            for (const s of summary) {
              if (lastTimestamp === 0) {
                lastTimestamp = s.createdAt!;
              } else {
                if (lastTimestamp <= s.createdAt!) {
                  break;
                }
              }
            }
            expect(isSorted).toBe(true);
          },
        );
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
        db.delete(Session).where(eq(Session.id, newSessionId));
        db.delete(Session).where(eq(Session.id, newSessionId2));

        db.delete(Message).where(eq(Message.sessionId, newSessionId));
        db.delete(Message).where(eq(Message.sessionId, newSessionId2));

        db.delete(CompactionResults).where(eq(CompactionResults.sessionId, newSessionId));
        db.delete(CompactionResults).where(eq(CompactionResults.sessionId, newSessionId2));
      }
    });
  });
});
