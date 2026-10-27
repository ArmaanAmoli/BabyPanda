import { getMessages } from '@baby-panda/db';
import { LogType, Role } from '@baby-panda/types';
import { MessageContentSchema } from '@baby-panda/types';
import type { CleanedMessage } from '@baby-panda/types';
import { writeLogs } from '@baby-panda/utils';

export type MessageHistory = Awaited<ReturnType<typeof getMessages>>;
const cwd = process.cwd().replaceAll('/', '-').replace('-', '');

export async function cleanMessageHistroy(messageHistory: MessageHistory) {
  const result = await Promise.all(
    messageHistory.map(async (m) => {
      let role = m.role;
      // let isThought = false;
      let content: string;
      if (!m.content) return;
      const rawContent = m.content.trim();
      const isToolResult = m.isToolResult ?? false;

      if (rawContent.at(0) !== '{') {
        content = rawContent;
      } else if (isToolResult) {
        // Tool results are model context, not chat history. They are shown
        // transiently through the websocket while the current turn runs.
        return;
      } else {
        try {
          const parsed = MessageContentSchema.parse(JSON.parse(m.content));
          if (parsed.content.answer != undefined || parsed.content.thought != undefined) {
            if (parsed.content.thought) {
              // isThought = true;
              role = Role.thought;
            }
            content = parsed.content.answer ?? parsed.content.thought ?? '';
            if (content.length === 0) return;
          } else {
            return; // ignore tool call message
          }
        } catch (err) {
          await writeLogs(LogType.server, cwd, m.sessionId!, `[ERROR WHILE CLEAN MESSAGE]: ${err}`);
          return undefined;
        }
      }
      return {
        role: role ?? Role.user,
        content: content,
        createdAt: m.createdAt,
        // isThought: isThought
      };
    }),
  );

  return result.filter((message): message is CleanedMessage => message !== undefined);
}
