import z from 'zod';
export enum Role {
  system = 'system',
  context = 'context',
  user = 'user',
  assistant = 'assistant',
  tool = 'tool',
  thought = 'thought',
}

export interface MessageRegular {
  role: Role;
  content: string;
  sessionId: string;
}

export type UserMessage = Omit<MessageRegular, 'role'> & { role: Role.user };
export type SystemMessage = Omit<MessageRegular, 'role'> & {
  role: Role.system;
};
export type AssistantMessage = Omit<MessageRegular, 'role'> & {
  role: Role.assistant;
};
export type ToolMessage = Omit<MessageRegular, 'role'> & {
  role: Role.user;
  tool_call_id: string;
};
export type MessageAPI = Omit<MessageRegular, 'sessionId'>;
export type Message =
  UserMessage | SystemMessage | AssistantMessage | ToolMessage | MessageRegular | MessageAPI; // universal Message Type
export type MessageDB = Message & { createdAt: Date };

export enum ContentType {
  answer = 'answer',
  thought = 'thought',
  tool_call = 'tool_call',
  unidentified = 'unidentified',
  permission = 'permission',
}

export const MessageContentSchema = z.object({
  role: z.string(),
  content: z.object({
    tool_call: z
      .array(
        z.object({
          id: z.string(),
          type: z.string(),
          function: z.string(),
          arguments: z.record(z.string(), z.unknown()),
        }),
      )
      .optional(),
    thought: z.string().optional(),
    answer: z.string().optional(),
  }),
});

export type MessageContent = z.infer<typeof MessageContentSchema>;

export const ToolRawResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  arguments: z.record(z.string(), z.unknown()),
  result: z.unknown().optional(),
  error: z.string().optional(),
});

export const CleanedMessageSchema = z.object({
  role: z.enum(Role),
  content: z.string(),
  createdAt: z.number().nullable(),
  // isThought: z.boolean().default(false).optional()
});

export const CleanedMessageArraySchema = z.array(CleanedMessageSchema);

export type CleanedMessage = z.infer<typeof CleanedMessageSchema>;

export enum LogType {
  agent = 'agent.log',
  mcp = 'mcp.log',
  db = 'db.log',
  server = 'server.log',
  cli = 'cli.log',
}

export const ServerStreamChunkSchema = z.object({
  contentType: z.enum(ContentType),
  content: z.string(),
  // isStopper:z.boolean().default(false)
});

export type ServerStreamChunkSchemaType = z.infer<typeof ServerStreamChunkSchema>;

export const UserPermissionSchema = z.object({
  toolCallId: z.string(),
  permission: z.boolean().default(false),
  content: z.string(),
});

export type UserPermission = z.infer<typeof UserPermissionSchema>;

export const WsEventTypeSchema = z.enum(['permission', 'ask_permission', 'always_allow']);

export const WsEventTypes = WsEventTypeSchema.enum;

const BaseSchema = z.object({});

export const WsEventMessageSchema = z.discriminatedUnion('eventType', [
  BaseSchema.extend({
    eventType: z.literal(WsEventTypeSchema.enum.permission),
    permissionGranted: z.boolean(),
    toolCallId: z.string(),
  }),
  BaseSchema.extend({
    eventType: z.literal(WsEventTypeSchema.enum.ask_permission),
    toolCallContent: z.string(),
    toolCallId: z.string(),
  }),
  BaseSchema.extend({
    eventType: z.literal(WsEventTypeSchema.enum.always_allow),
  }),
]);

export type WsEventMessage = z.infer<typeof WsEventMessageSchema>;
