import { db } from './index.db'
import { Session, Message, ApiKeys } from './db/schema'
import type { Role } from '@baby-panda/agent';
import { eq, sql } from 'drizzle-orm'
interface APIProvider {
    provider: string;
    endpoint: string;
    key: string;
}
export async function createSession(parentSessionId?: string) {
    const id: string = crypto.randomUUID()
    await db.insert(Session).values(parentSessionId ? { id, parentSessionId } : { id });
    return id;
}
export async function createMessage(sessionId: string, content: string, role: Role) {
    await db.transaction(async (tx) => {
        const session = await tx.select({
            messageCount: Session.messagesCount,
        }).from(Session).where(eq(Session.id, sessionId));
        console.log(`session:`, session)
        if (!session[0] || session[0].messageCount === null) {
            tx.rollback();
            throw new Error(`Unable to find Session`)
        }
        const messageIndex = session[0].messageCount;
        await tx.insert(Message).values({
            messageIndex: messageIndex,
            sessionId: sessionId,
            createdAt: new Date().toISOString(), // Fixes the database driver positioning crash
            content: content,
            role: role as any
        } as typeof Message.$inferInsert);
        await tx.update(Session).set({ messagesCount: messageIndex + 1 }).where(eq(Session.id, sessionId));
    })
}
export async function addProvider(details: APIProvider) {
    console.log(details)
    try {
        await db.insert(ApiKeys).values({ provider: details.provider, endpoint: details.endpoint, key: details.key });
        return true;
    } catch (err) {
        console.log(`Error occred while adding provider, ${err}`);
        throw new Error(`Error occred while adding provider, ${err}`);
    }
}
export async function getMessages(sessionId: string) {
    const messages = await db.select().from(Message).where(eq(Message.sessionId, sessionId));
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