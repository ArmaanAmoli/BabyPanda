import z from 'zod';
import { ToolError } from './error';

export enum OpenAiRoles {
  system = 'system',
  user = 'user',
  assistant = 'assistant',
  tool = 'tool',
}

export enum Role {
  system = 'system',
  user = 'user',
  assistant = 'assistant',
  tool = 'tool',
  compaction = 'compaction',
}

export enum ReasoningEffort {
  none = 'none',
  low = 'low',
  medium = 'medium',
  high = 'high',
}

// export interface MessageRegular {
//   role: Role;
//   content: string | null;
//   sessionId: string;
//   tool_calls?: ToolCall[];
//   tool_call_id?: string;
// }

// export interface ToolCall {
//   id: string;
//   type: 'function';
//   function: {
//     name: string;
//     arguments: string;
//   };
// }

export const ToolCallSchema = z.object({
  id: z.string(),
  type: z.literal('function'),
  function: z.object({
    name: z.string(),
    arguments: z.string(),
  }),
});

export type ToolCall = z.infer<typeof ToolCallSchema>;

export const UserMessageSchema = z.object({
  role: z.literal(Role.user),
  content: z.string(),
});

export type UserMessage = z.infer<typeof UserMessageSchema>;

export const SystemMessageSchema = z.object({
  role: z.literal(Role.system),
  content: z.string(),
});

export type SystemMessage = z.infer<typeof SystemMessageSchema>;

// const AgentToolCallSchemaUncertain = z.object({
//   index: z.number(),
//   id: z.string().optional(),
//   type: z.literal('function').optional(),
//   function: z.object({
//     name: z.string().optional(),
//     arguments: z.string().optional(),
//   }).optional(),
// });

export const AssistantMessageSchema = z.object({
  role: z.literal(Role.assistant),
  content: z.string(),
  reasoning_content: z.string(),
  tool_calls: z.array(ToolCallSchema),
});

export type AssistantMessage = z.infer<typeof AssistantMessageSchema>;

export const ToolMessageSchema = z.object({
  role: z.literal(Role.tool),
  content: z.string(),
  tool_call_id: z.string(),
});

export type ToolMessage = z.infer<typeof ToolMessageSchema>;

export const CompactionMessageSchema = z.object({
  role: z.literal(Role.compaction),
  content: z.string(),
});
export type CompactionMessage = z.infer<typeof CompactionMessageSchema>;

export type MessagesArray = (AssistantMessage | UserMessage | ToolMessage | SystemMessage)[];

export type DBMessage = {
  id: string;
  sessionId: string;
  content: string;
  role: Role;
  sequence: number;
};

// export type UserMessage = Omit<MessageRegular, 'role'> & { role: Role.user };
// export type SystemMessage = Omit<MessageRegular, 'role'> & {
//   role: Role.system;
// };
// export type AssistantMessage = Omit<MessageRegular, 'role'> & {
//   role: Role.assistant;
// };
// export type ToolMessage = Omit<MessageRegular, 'role'> & {
//   role: Role.tool;
//   tool_call_id: string;
// };
// export type MessageAPI = Omit<MessageRegular, 'sessionId'>;
// export type Message =
//   UserMessage | SystemMessage | AssistantMessage | ToolMessage | MessageRegular | MessageAPI; // universal Message Type
// export type MessageDB = Message & { createdAt: Date };

export enum ContentType {
  content = 'content',
  reasoning_content = 'reasoning_content',
  tool_call = 'tool_call',
  unidentified = 'unidentified',
  permission = 'permission',
}

// export const MessageContentSchema = z.object({
//   role: z.string(),
//   content: z.object({
//     /* tool_call: z
//        .array(
//          z.object({
//            id: z.string(),
//            type: z.string(),
//            function: z.string(),
//            arguments: z.record(z.string(), z.unknown()),
//          }),
//        )
//        .optional(),*/
//     thought: z.string().optional(),
//     answer: z.string().optional(),
//   }),
// });

// export type MessageContent = z.infer<typeof MessageContentSchema>;

// export const ToolRawResultSchema = z.object({
//   id: z.string(),
//   name: z.string(),
//   arguments: z.record(z.string(), z.unknown()),
//   result: z.unknown().optional(),
//   error: z.string().optional(),
// });

// export const CleanedMessageSchema = z.object({
//   role: z.enum(Role),
//   content: z.string(),
//   createdAt: z.number().nullable(),
//   // isThought: z.boolean().default(false).optional()
// });

// export const CleanedMessageArraySchema = z.array(CleanedMessageSchema);

// export type CleanedMessage = z.infer<typeof CleanedMessageSchema>;

export enum LogType {
  agent = 'agent.log',
  mcp = 'mcp.log',
  db = 'db.log',
  server = 'server.log',
  cli = 'cli.log',
}

export const ServerStreamChunkSchema = z.object({
  role: z.enum(ContentType),
  content: z.string(),
});

export type ServerStreamChunkSchemaType = z.infer<typeof ServerStreamChunkSchema>;

export const UserPermissionSchema = z.object({
  toolCallId: z.string(),
  permission: z.boolean().default(false),
  content: z.string(),
});

export type UserPermission = z.infer<typeof UserPermissionSchema>;

export const WsEventTypeSchema = z.enum(['permission', 'message', 'setting', 'tool']);

export const WsEventTypes = WsEventTypeSchema.enum;

export const PermissionsEnumsSchema = z.enum(['allowOnce', 'allowAlways']);
export const PermissionsEnums = PermissionsEnumsSchema.enum;

const BaseSchema = z.object({});

export const WsEventMessageSchema = z.discriminatedUnion('eventType', [
  z.discriminatedUnion('permission', [
    BaseSchema.extend({
      eventType: z.literal(WsEventTypeSchema.enum.permission),
      permission: z.enum(PermissionsEnums).exclude([PermissionsEnums.allowAlways]),
      permissionGranted: z.boolean(),
      toolCallId: z.string(),
    }),
    BaseSchema.extend({
      eventType: z.literal(WsEventTypeSchema.enum.permission),
      permission: z.literal(PermissionsEnums.allowAlways),
    }),
  ]),
  z.discriminatedUnion('role', [
    BaseSchema.extend({
      eventType: z.literal(WsEventTypeSchema.enum.message),
      role: z.enum(Role).exclude([Role.assistant]),
      content: z.string(),
    }),
    BaseSchema.extend({
      eventType: z.literal(WsEventTypeSchema.enum.message),
      role: z.literal(Role.assistant),
      contentType: z.enum(ContentType),
      content: z.string(),
    }),
  ]),
  BaseSchema.extend({
    eventType: z.literal(WsEventTypeSchema.enum.setting),
    setting: z.object({
      sandbox: z.boolean().optional(),
      provider: z.string().optional(),
      model: z.string().optional(),
      reasoningEffort: z.enum(ReasoningEffort).optional(),
      apiKey: z.string().optional(),
    }),
  }),
]);

export type WsEventMessage = z.infer<typeof WsEventMessageSchema>;

export const WsCommonMessageSchema = z.object({
  eventType: z.enum(WsEventTypes),
  payload: z.unknown(),
});

export type WsCommonMessage = z.infer<typeof WsCommonMessageSchema>;

export const ShellCallSchema = z.object({
  command: z.string().min(1),
  timeout: z.number().int().positive().max(600_000).default(120000).optional(),
});

export const ReadToolSchema = z.object({
  path: z.string().describe('Location of file'),
  offset: z.number().optional().describe('Starting line number'),
  limit: z.number().optional().describe('Number of lines coming after offset (including offset)'),
});

export const GrepToolSchema = z.object({
  path: z.string().describe('Location of file'),
  pattern: z.string().describe('Regular expression for searching'),
  flag: z
    .string()
    .describe('flags to use (spawn process of nodeJs) [flag , pattern , path]')
    .optional(),
});

export const EditToolSchema = z.object({
  path: z.string().describe('Location of file'),
  old_str: z.string().describe('String that will be replaced'),
  new_str: z.string().describe('The string that will replace'),
});

export const GlobToolSchema = z.object({
  pattern: z.string().describe('String that will be replaced'),
  ignorePatterns: z.array(z.string()).describe('The string that will replace').optional(),
});

export const DeleteToolSchema = z.object({
  path: z.string().describe('path of the file'),
  options: z
    .object({
      force: z.boolean().optional().default(false),
      maxRetries: z.number().optional().default(0),
      recursive: z.boolean().optional().default(false),
      retryDelay: z.number().default(100),
    })
    .optional(),
});

export const ListToolSchema = z.object({
  path: z.string(),
});

export const WriteToolSchema = z.object({
  path: z.string(),
  content: z.string(),
});

export const MkdirSchema = z.object({
  path: z.string(),
});

export const WebSearchSchema = z.object({
  query: z.string(),
});

export const GetWebPageSchema = z.object({
  url: z.array(z.string()),
});

export const ToolContentFrontEndSchema = z.object({ name: z.string(), argument: z.unknown() });

export const ReadSkillSchema = z.object({
  name: z.string(),
});

export { ToolError };
