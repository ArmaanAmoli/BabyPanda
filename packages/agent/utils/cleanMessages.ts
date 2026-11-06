import { Role, type MessageAPI } from '@baby-panda/types';

type MessageLike = {
  role?: string | null;
  content?: unknown;
  tool_calls?: unknown;
  tool_call_id?: unknown;
};

const allowedRoles = new Set<string>([Role.system, Role.user, Role.assistant, Role.tool]);

export function cleanMessages(history: MessageLike[]): MessageAPI[] {
  return history.map((message) => {
    const rawContent = typeof message.content === 'string' ? message.content : null;
    const cleaned: MessageAPI = {
      role: allowedRoles.has(message.role ?? '') ? (message.role as Role) : Role.user,
      content: rawContent,
    };
    if (Array.isArray(message.tool_calls)) {
      cleaned.tool_calls = message.tool_calls;
    }
    if (typeof message.tool_call_id === 'string') {
      cleaned.tool_call_id = message.tool_call_id;
    }
    if (rawContent?.startsWith('{')) {
      try {
        const encoded = JSON.parse(rawContent) as {
          content?: string | null;
          tool_calls?: unknown;
          tool_call_id?: unknown;
        };
        if (Array.isArray(encoded.tool_calls)) {
          cleaned.content = encoded.content ?? null;
          cleaned.tool_calls = encoded.tool_calls;
        } else if (typeof encoded.tool_call_id === 'string') {
          cleaned.content =
            typeof encoded.content === 'string' ? encoded.content : JSON.stringify(encoded.content);
          cleaned.tool_call_id = encoded.tool_call_id;
        }
      } catch {
        // Preserve ordinary JSON message content.
      }
    }
    return cleaned;
  });
}
