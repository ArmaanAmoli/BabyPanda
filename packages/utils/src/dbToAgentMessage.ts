import { Role } from '@baby-panda/types';
import type { DBMessage, MessagesArray, SkillHistoryEntry } from '@baby-panda/types';

/**
 * Converts DB rows to the history shape the CLI renders. The outer row role is
 * authoritative: a `role: 'skill'` row is returned as a SkillHistoryEntry
 * (name + wrapped content) instead of the inner provider-facing JSON.
 */
export function dbToAgentMessages(
  dbMessages: DBMessage[],
): (MessagesArray[number] | SkillHistoryEntry)[] {
  return dbMessages.map((msg) => {
    if (msg.role === Role.skill) {
      const parsed = JSON.parse(msg.content) as { name?: unknown; content?: unknown };
      return {
        role: Role.skill,
        name: typeof parsed.name === 'string' ? parsed.name : '',
        content: typeof parsed.content === 'string' ? parsed.content : '',
      };
    }
    return JSON.parse(msg.content);
  });
}
