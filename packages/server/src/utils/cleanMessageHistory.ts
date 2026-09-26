import { getMessages } from "@baby-panda/db";
import { Role } from '@baby-panda/types'
import { MessageContentSchema, ToolRawResultSchema } from '@baby-panda/types'

type MessageHistory = Awaited<ReturnType<typeof getMessages>>;
interface CleanedMessage{
    role: Role | null,
    content: string,
    createdAt: number | null
}

export function cleanMessageHistroy(messageHistory: MessageHistory) {
    const result = messageHistory.map((m) => {
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
        }
    });

    const finalResult:CleanedMessage[] = [];
    result.forEach((r)=>{
        if(r){
            finalResult.push(r);
        }
    })
    return finalResult;
}