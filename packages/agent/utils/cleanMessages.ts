import { Role, type MessageAPI } from '@baby-panda/types';

type MessageLike = {
  role?: string | null;
  content?: unknown;
};

const allowedRoles = new Set<string>([Role.system, Role.user, Role.assistant]);

export function cleanMessages(history: MessageLike[]): MessageAPI[] {
  return history.map((message) => ({
    role: allowedRoles.has(message.role ?? '') ? (message.role as Role) : Role.user,
    content: String(message.content ?? ''),
  }));
}
