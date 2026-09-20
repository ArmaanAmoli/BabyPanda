import {integer, primaryKey, sqliteTable , text} from "drizzle-orm/sqlite-core"
import {Role} from "@baby-panda/agent"
import {sql} from "drizzle-orm"

export const Session = sqliteTable("session" , {
    id: text("session_id").primaryKey(),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
    parentSessionId: text("parent_session_id"),
    messagesCount:integer("messages_count").default(0),
    tokensInContextWindow:integer("tokens_in_context_window").default(0),
    projectDirectory:text("project_directory")
});

export const Message = sqliteTable("message" , {
    messageIndex: integer("message_index"),
    sessionId: text("session_id").references(()=>Session.id),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
    content:text("content"),
    role:text("role").$type<Role>(),
},(table)=>[primaryKey({columns:[table.messageIndex , table.sessionId]})]);

export const ApiKeys = sqliteTable("api_keys", {
    provider:text("provider"),
    endpoint:text("endpoint"),
    key:text("key").primaryKey(),
});

export const CompactionResults = sqliteTable("compaction_results" , {
    sessionId: text("session_id").references(()=>Session.id),
    createdAt: integer("created_at"),
    content: text("content"),
}, (table)=>[primaryKey({columns:[table.sessionId , table.createdAt]})]);
