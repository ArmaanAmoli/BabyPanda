import {integer, primaryKey, sqliteTable , text} from "drizzle-orm/sqlite-core"
import {Role} from "@baby-panda/agent"

export const Session = sqliteTable("session" , {
    id: integer().primaryKey({autoIncrement:true}).default(Math.floor(performance.now() * 1000)),
    createdAt: text("created_at").$type<Date>(),
    parentSessionId: integer("parent_session_id"),
})

export const Message = sqliteTable("message" , {
    messageId: integer("message_id").primaryKey({autoIncrement:true}).default(Math.floor(performance.now() * 1000)),
    sessionId: integer("session_id").references(()=>Session.id),
    content:text(),
    role:text().$type<Role>(),
})
