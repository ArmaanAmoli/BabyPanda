import z from 'zod';
import { ToolError } from './error';

const BaseSchema = z.object({});

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
  // User-invoked skill injection. Stored in the DB like any other row, but the
  // provider only ever sees it as a `user` message (see cleanMessage).
  skill = 'skill',
}

export enum ReasoningEffort {
  none = 'none',
  minimal = 'minimal',
  low = 'low',
  medium = 'medium',
  high = 'high',
  xhigh = 'xhigh',
  max = 'max',
}

export const ToolCallSchema = z.object({
  id: z.string(),
  type: z.literal('function'),
  function: z.object({
    name: z.string(),
    arguments: z.string(),
  }),
});

export type ToolCall = z.infer<typeof ToolCallSchema>;

export const ImageUrlSchema = z.string();

export const TextContentPartSchema = BaseSchema.extend({
  type: z.literal('text'),
  text: z.string(),
});

export const ImageContentPartSchema = BaseSchema.extend({
  type: z.literal('image'),
  image: ImageUrlSchema,
});

/**
 * OpenAI-style content parts for a user message: text parts plus image parts
 * (each image is a data URL). An array rather than a fixed [text, image]
 * tuple so one prompt can carry several pasted images.
 */
export const MultiModalContentSchema = z.array(
  z.union([TextContentPartSchema, ImageContentPartSchema]),
);

export type MultiModalContent = z.infer<typeof MultiModalContentSchema>;
export type ImageContentPart = z.infer<typeof ImageContentPartSchema>;

export const UserMessageSchema = z.object({
  role: z.literal(Role.user),
  content: z.string().or(MultiModalContentSchema),
});

export type UserMessage = z.infer<typeof UserMessageSchema>;

export const SystemMessageSchema = z.object({
  role: z.literal(Role.system),
  content: z.string(),
});

export type SystemMessage = z.infer<typeof SystemMessageSchema>;

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

/**
 * A skill activated by the user via `/<skill-name>` in the CLI. The DB row has
 * `role: 'skill'` and its content is the JSON of the inner provider-facing
 * message plus the skill name (used by the CLI to render the loaded notice).
 */
export const SkillMessageSchema = z.object({
  role: z.literal(Role.user),
  name: z.string(),
  content: z.string(),
});
export type SkillMessage = z.infer<typeof SkillMessageSchema>;

/** History entry as the CLI sees it: the outer DB row role wins. */
export const SkillHistoryEntrySchema = z.object({
  role: z.literal(Role.skill),
  name: z.string(),
  content: z.string(),
});
export type SkillHistoryEntry = z.infer<typeof SkillHistoryEntrySchema>;

/** Server -> CLI notification about a skill activation attempt. */
export const SkillEventPayloadSchema = z.object({
  name: z.string(),
  ok: z.boolean(),
  error: z.string().optional(),
});
export type SkillEventPayload = z.infer<typeof SkillEventPayloadSchema>;

/** Server -> CLI notification that context compaction started or finished. */
export const CompactionEventPayloadSchema = z.object({
  compacting: z.boolean(),
});
export type CompactionEventPayload = z.infer<typeof CompactionEventPayloadSchema>;

export type MessagesArray = (AssistantMessage | UserMessage | ToolMessage | SystemMessage)[];

export type DBMessage = {
  id: string;
  sessionId: string;
  content: string;
  role: Role;
  sequence: number;
};

export enum ContentType {
  content = 'content',
  reasoning_content = 'reasoning_content',
  tool_call = 'tool_call',
  tool_result = 'tool_result',
  unidentified = 'unidentified',
  permission = 'permission',
}

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

export const WsEventTypeSchema = z.enum([
  'permission',
  'message',
  'setting',
  'tool',
  'tool_result',
  'skill',
  'compaction',
]);

export const WsEventTypes = WsEventTypeSchema.enum;

/**
 * Server -> CLI notification that the agent issued one batch of tool calls
 * (a single assistant message). `arguments` is the parsed argument object,
 * not the raw JSON string the provider sent.
 */
export const WsToolCallRequestSchema = z.object({
  id: z.string(),
  name: z.string(),
  arguments: z.record(z.string(), z.unknown()),
});
export type WsToolCallRequest = z.infer<typeof WsToolCallRequestSchema>;

export const WsToolCallStatsSchema = z.object({
  lines: z.number().int().nonnegative().optional(),
  added: z.number().int().nonnegative().optional(),
  removed: z.number().int().nonnegative().optional(),
  matches: z.number().int().nonnegative().optional(),
  results: z.number().int().nonnegative().optional(),
});
export type WsToolCallStats = z.infer<typeof WsToolCallStatsSchema>;

export const WsToolPageResultSchema = z.object({
  url: z.string(),
  success: z.boolean(),
  error: z.string().optional(),
});
export type WsToolPageResult = z.infer<typeof WsToolPageResultSchema>;

/**
 * Server -> CLI notification that a single tool call finished. `before` is
 * only present for write/edit: the file content immediately before that
 * mutation (null = the file did not exist). `pages` is only present for
 * get_web_page and carries one outcome per requested URL.
 */
export const WsToolResultEventSchema = z.object({
  id: z.string(),
  name: z.string(),
  success: z.boolean(),
  error: z.string().optional(),
  before: z.string().nullish(),
  stats: WsToolCallStatsSchema.optional(),
  pages: z.array(WsToolPageResultSchema).optional(),
});
export type WsToolResultEvent = z.infer<typeof WsToolResultEventSchema>;

/**
 * Persisted shape of a tool DB row's JSON content: the raw result plus the
 * outcome metadata the CLI needs to render history (status, before-snapshot,
 * stats). `content` stays a string so ToolMessageSchema remains valid.
 */
export const ToolResultRecordSchema = z.object({
  role: z.literal(Role.tool),
  tool_call_id: z.string(),
  content: z.string(),
  success: z.boolean().optional(),
  error: z.string().optional(),
  before: z.string().nullish(),
  stats: WsToolCallStatsSchema.optional(),
  pages: z.array(WsToolPageResultSchema).optional(),
});
export type ToolResultRecord = z.infer<typeof ToolResultRecordSchema>;

export const PermissionsEnumsSchema = z.enum(['allowOnce', 'allowAlways']);
export const PermissionsEnums = PermissionsEnumsSchema.enum;

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
      // skill content only travels via the dedicated `skill` event
      role: z.enum(Role).exclude([Role.assistant, Role.skill]),
      content: z.string().or(MultiModalContentSchema),
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
  BaseSchema.extend({
    eventType: z.literal(WsEventTypeSchema.enum.skill),
    name: z.string().min(1),
    args: z.string().optional(),
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

/**
 * Search flags the model may pass to the `grep` tool. `-r` (recursive) and
 * `-n` (line numbers) are always applied by the tool itself, so they are not
 * part of this list. Keep in sync with the allow-list enforced in
 * packages/agent/mcp/tools/FileSystem/filesystem.ts.
 */
export const GREP_FLAGS = ['i', 'w', 'v', 'F'] as const;
export type GrepFlag = (typeof GREP_FLAGS)[number];

export const GrepToolSchema = z.object({
  path: z.string().describe('Directory or file to search'),
  pattern: z.string().describe('Regular expression for searching'),
  flag: z
    .enum(GREP_FLAGS)
    .describe(
      'Optional search flags: i = ignore case, w = whole words only, v = select non-matching lines, F = literal string instead of a regex',
    )
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

/**
 * What a row in `api_keys` is for. `model` rows are LLM provider credentials
 * (the key doubles as the primary key of the table); `web` rows are
 * credentials for web-facing tools such as Exa. Splitting them by type keeps
 * "which providers can I chat with" and "which web tools are configured"
 * separable as more of each are added.
 */
export type ApiKeyType = 'model' | 'web';

export const API_KEY_TYPES: ApiKeyType[] = ['model', 'web'];

/** Provider name used for Exa credentials in the `api_keys` table. */
export const EXA_PROVIDER = 'exa';

/** Endpoint stored alongside an Exa key; matches the exa-js default. */
export const EXA_ENDPOINT = 'https://api.exa.ai';

export const ReadSkillSchema = z.object({
  name: z.string(),
});

export const AddSkillSchema = z.object({
  // Must match the folder-name regex used by skill discovery
  // (skillFoldersNameRegex in @baby-panda/utils), otherwise the created
  // folder is skipped and the skill stays invisible.
  name: z
    .string()
    .nonempty()
    .regex(/^[a-z]+(-+[a-z]+)*$/, 'lowercase letters and single hyphens only, e.g. "code-review"'),
  description: z.string().nonempty(),
  content: z.string().nonempty(),
  isGlobal: z.boolean().default(false),
  disableModelInvocation: z.boolean().default(false),
});
export type AddSkill = z.infer<typeof AddSkillSchema>;
export { ToolError };
