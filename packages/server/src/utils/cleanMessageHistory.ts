import { getMessages } from "@baby-panda/db";
import { Role } from '@baby-panda/types'
import { MessageContentSchema, ToolRawResultSchema } from '@baby-panda/types'
import type { CleanedMessage } from '@baby-panda/types'


type MessageHistory = Awaited<ReturnType<typeof getMessages>>;

export function cleanMessageHistroy(messageHistory: MessageHistory) {
    const result = messageHistory.map((m) => {
        let isThought = false;
        let content: string = '';
        if (!m.content) return;
        const rawContent = m.content.trim();
        const isToolResult = m.isToolResult ?? false;

        if (rawContent.at(0) !== '{') {
            content = rawContent;
        }
        else if (isToolResult) {
            const parsed = ToolRawResultSchema.parse(JSON.parse(rawContent));
            let argsString = '';
            Object.entries(parsed.arguments).forEach(([key, value]) => {
                argsString += ` | ${key} : ${value}`;
            })
            content = `${parsed.name}: ${argsString} \n`;
        }
        else {
            const parsed = MessageContentSchema.parse(JSON.parse(m.content));
            if (parsed.content.answer != undefined || parsed.content.thought != undefined) {
                if(parsed.content.thought)isThought=true;
                content = parsed.content.answer ?? parsed.content.thought ?? "";
                if (content.length === 0) return;
            }
            else {
                return; // ignore tool call message
            }
        }
        return {
            role: isToolResult ? Role.tool : m.role,
            content: content,
            createdAt: m.createdAt,
            isThought: isThought
        }
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
        }
        else {
            if(isAccumulating){
                isAccumulating = false;
                finalResult.push({ role: Role.tool, content: accumulatedContent, createdAt: toolCreatedAt });
            }
            finalResult.push(m);
        }
    }
    if(isAccumulating){
        finalResult.push({ role: Role.tool, content: accumulatedContent, createdAt: toolCreatedAt });
    }
    // console.log(finalResult);
    return finalResult;
}

// cleanMessageHistroy(await getMessages("14a5444a-466e-49ef-96a1-9b7139d8f42e"));