import { getMessages } from '@baby-panda/db';
import { LogType, Role } from '@baby-panda/types';
import { MessageContentSchema, ToolRawResultSchema } from '@baby-panda/types';
import type { CleanedMessage } from '@baby-panda/types';
import { writeLogs } from '@baby-panda/utils';

export type MessageHistory = Awaited<ReturnType<typeof getMessages>>;
const cwd = process.cwd().replaceAll('/', '-').replace('-', '');

export function cleanMessageHistroy(messageHistory: MessageHistory) {
  const result = messageHistory.map((m) => {
    let role = m.role;
    // let isThought = false;
    let content = '';
    if (!m.content) return;
    const rawContent = m.content.trim();
    const isToolResult = m.isToolResult ?? false;

    if (rawContent.at(0) !== '{') {
      content = rawContent;
    } else if (isToolResult) {
      try {
        role = Role.tool;
        const parsed = ToolRawResultSchema.safeParse(JSON.parse(rawContent));
        if (!parsed.success) {
          return;
        }
        let argsString = '';
        Object.entries(parsed.data.arguments).forEach(([key, value]) => {
          argsString += ` | ${key} : ${value}`;
        });
        content = `${parsed.data.name}: ${argsString} \n`;
      } catch (err) {
        writeLogs(
          LogType.server,
          cwd,
          m.sessionId!,
          `[ERROR WHILE CLEAN MESSAGE]: ${err} ${rawContent}`,
        );
        return undefined;
      }
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
        writeLogs(LogType.server, cwd, m.sessionId!, `[ERROR WHILE CLEAN MESSAGE]: ${err}`);
        return undefined;
      }
    }
    return {
      role: role ?? Role.user,
      content: content,
      createdAt: m.createdAt,
      // isThought: isThought
    };
  });

  const finalResult: CleanedMessage[] = MergeToolCallMessages(result);
  return finalResult;
}

function MergeToolCallMessages(messages: (CleanedMessage | undefined)[]) {
  const finalResult: CleanedMessage[] = [];
  let isAccumulating = false;
  let accumulatedContent: string = '';
  let toolCreatedAt: number | null = null;
  for (const m of messages) {
    if (m === undefined) continue;
    if (m.role === Role.tool) {
      // Start or continue accumulating tool messages
      if (!isAccumulating) {
        isAccumulating = true;
        toolCreatedAt = m.createdAt; // Capture the timestamp of the first tool message
      }
      // Combine contents with a newline separator
      accumulatedContent += (accumulatedContent ? '\n' : '') + m.content;
    } else {
      if (isAccumulating) {
        isAccumulating = false;
        finalResult.push({
          role: Role.tool,
          content: accumulatedContent,
          createdAt: toolCreatedAt,
        });
      }
      finalResult.push(m);
    }
  }
  if (isAccumulating) {
    finalResult.push({
      role: Role.tool,
      content: accumulatedContent,
      createdAt: toolCreatedAt,
    });
  }
  // console.log(finalResult);
  return finalResult;
}
