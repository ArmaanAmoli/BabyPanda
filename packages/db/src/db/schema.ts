import {integer, primaryKey, sqliteTable , text} from "drizzle-orm/sqlite-core"
import {Role} from "@baby-panda/agent"
import {sql} from "drizzle-orm"

export const Session = sqliteTable("session" , {
    id: text("session_id").primaryKey(),
    createdAt: text("created_at").$type<Date>().default(sql`(CURRENT_TIMESTAMP)`),
    parentSessionId: text("parent_session_id"),
    messagesCount:integer("messages_count").default(0)
})

export const Message = sqliteTable("message" , {
    messageIndex: integer("message_index"),
    sessionId: text("session_id").references(()=>Session.id),
    createdAt: text("created_at").$type<Date>().default(sql`(CURRENT_TIMESTAMP)`),
    content:text("content"),
    role:text("role").$type<Role>(),
},(table)=>[primaryKey({columns:[table.messageIndex , table.sessionId]})])
