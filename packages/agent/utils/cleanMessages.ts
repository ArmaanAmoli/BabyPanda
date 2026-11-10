import {
  AssistantMessageSchema,
  Role,
  SystemMessageSchema,
  ToolMessageSchema,
  UserMessageSchema,
  type DBMessage,
  type MessagesArray,
  type ToolCall,
} from '@baby-panda/types';
// import type { UserMessage, SystemMessage } from '@baby-panda/types';

/**
 * DB rows store each message as a JSON-encoded string in `content`, and the
 * shapes in there evolved over time, so `role` is not always present:
 *
 * - user:        `{"role":"user","content":"..."}`
 * - assistant:   `{"role":"assistant","content":"...","reasoning_content":"...","tool_calls":[...]}`
 *                (older rows may omit `role`)
 * - tool result: `{"role":"tool","tool_call_id":"...","content":"..."}`
 *                (older rows are just `{"tool_call_id":"...","content":...}`)
 * - compaction:  raw summary text that is not JSON at all
 */

type HistoryRow = Pick<DBMessage, 'content' | 'role'>;

/**
 * normalizeToolCalls -> raw toolCall array from provider -> fills default values where model left null
 * Accumulated tool-call fragments may miss `id`, `type` or `arguments` after
 * a malformed or aborted stream; the provider needs the canonical shape.
 */
export function normalizeToolCalls(toolCalls: unknown): ToolCall[] {
  if (!Array.isArray(toolCalls)) return [];
  return toolCalls
    .filter((call) => call != null && typeof call === 'object')
    .map((rawCall, index) => {
      const call = rawCall as Record<string, unknown>;
      const fn = (call.function ?? {}) as Record<string, unknown>;
      return {
        id: typeof call.id === 'string' ? call.id : `call-${index}`,
        type: 'function' as const,
        function: {
          name: typeof fn.name === 'string' ? fn.name : 'unknown',
          arguments:
            typeof fn.arguments === 'string' ? fn.arguments : JSON.stringify(fn.arguments ?? {}),
        },
      };
    });
}

/**
 * This function converts db message row to OpenAI message syntax
 */
export function cleanMessage(row: HistoryRow): MessagesArray[number] {
  const { role, content } = row;
  const parsed = JSON.parse(content);
  switch (role) {
    case Role.tool: {
      return ToolMessageSchema.parse(parsed);
    }
    case Role.compaction: {
      return UserMessageSchema.parse(parsed);
    }
    case Role.assistant: {
      return AssistantMessageSchema.parse(parsed);
    }
    case Role.system: {
      return SystemMessageSchema.parse(parsed);
    }
    case Role.user: {
      return UserMessageSchema.parse(parsed);
    }
    case Role.skill: {
      // Stored as {"role":"user","name":...,"content":"<skill>...</skill>"};
      // the provider only accepts native roles, so it goes out as a user
      // message (UserMessageSchema strips the extra `name` key).
      return UserMessageSchema.parse(parsed);
    }
  }
}

export function cleanMessages(rows: HistoryRow[]): MessagesArray {
  return rows.map((row) => cleanMessage(row));
}
