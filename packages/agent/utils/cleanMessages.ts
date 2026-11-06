import { Role, type DBMessage, type MessagesArray, type ToolCall } from '@baby-panda/types';
import type { CompactionMessage, UserMessage, SystemMessage } from '@baby-panda/types';

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

type MessageLike = {
  role?: unknown;
  content?: unknown;
  tool_calls?: unknown;
  tool_call_id?: unknown;
  reasoning_content?: unknown;
};

const ROLE_VALUES = new Set<Role>(Object.values(Role));

const isRole = (value: unknown): value is Role =>
  typeof value === 'string' && ROLE_VALUES.has(value as Role);

/**
 * MCP tool results nest text as `{content:[{type:'text','text':'...'}]}`;
 * the model needs it flattened to a plain string.
 */
export function contentToText(content: unknown): string {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part != null && typeof part === 'object') {
          const text = (part as { text?: unknown }).text;
          if (typeof text === 'string') return text;
          return JSON.stringify(part);
        }
        return String(part);
      })
      .join('\n');
  }
  if (typeof content === 'object') return JSON.stringify(content);
  return String(content);
}

/**
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

export function cleanMessage(row: HistoryRow): MessagesArray[number] {
  // The DB row role is the most trustworthy signal for the stored content.
  const rowRole = isRole(row.role) ? row.role : Role.user;
  let entry: unknown;
  try {
    entry = JSON.parse(row.content);
  } catch {
    // Plain text content (e.g. compaction summaries stored as raw strings).
    return plainMessage(rowRole, row.content);
  }

  if (entry == null || typeof entry !== 'object' || Array.isArray(entry)) {
    return plainMessage(rowRole, contentToText(entry));
  }

  let message = entry as MessageLike;
  // Older rows hid the real message inside a JSON-encoded `content` string.
  if (
    !isRole(message.role) &&
    typeof message.content === 'string' &&
    message.content.trimStart().startsWith('{')
  ) {
    try {
      const inner = JSON.parse(message.content) as unknown;
      if (inner !== null && typeof inner === 'object' && !Array.isArray(inner)) {
        message = { ...message, ...(inner as MessageLike) };
      }
    } catch {
      // Ordinary text content that merely starts with `{` — leave it alone.
    }
  }

  const text = contentToText(message.content);

  let role: Role;
  if (isRole(message.role)) {
    role = message.role;
  } else if (typeof message.tool_call_id === 'string') {
    role = Role.tool;
  } else if (message.tool_calls != null) {
    role = Role.assistant;
  } else {
    role = rowRole;
  }

  if (role === Role.tool) {
    return {
      role: Role.tool,
      tool_call_id:
        typeof message.tool_call_id === 'string' ? message.tool_call_id : 'unknown-tool-call',
      content: text,
    };
  }
  if (role === Role.assistant) {
    return {
      role: Role.assistant,
      content: text,
      reasoning_content:
        typeof message.reasoning_content === 'string' ? message.reasoning_content : '',
      tool_calls: normalizeToolCalls(message.tool_calls),
    };
  }
  return plainMessage(role, text);
}

export function cleanMessages(rows: HistoryRow[]): MessagesArray {
  return rows.map((row) => cleanMessage(row));
}

function plainMessage(
  role: Role,
  content: string,
): UserMessage | SystemMessage | CompactionMessage {
  if (role === Role.system) return { role: Role.system, content };
  if (role === Role.compaction) return { role: Role.compaction, content };
  return { role: Role.user, content };
}
