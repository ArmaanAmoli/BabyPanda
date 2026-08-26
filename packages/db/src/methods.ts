import { db } from './index.db'
import { Session, Message } from './db/schema'
import type { Role } from '@baby-panda/agent';
import { eq } from 'drizzle-orm'

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
        if (!session[0] || !session[0].messageCount) {
            tx.rollback();
            throw new Error(`Unable to find Session`)
        }
        const messageIndex: number = session[0].messageCount;
        await tx.insert(Message).values({ messageIndex, content, role, sessionId });
        tx.update(Session).set({ messagesCount: messageIndex + 1 }).where(eq(Session.id, sessionId));
    })
}

export async function getMessages(sessionId:string){
    const messages = await db.select().from(Message).where(eq(Message.sessionId , sessionId));
    return messages;
}