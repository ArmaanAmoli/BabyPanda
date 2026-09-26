import z from 'zod';
export enum Role {
    system = 'system',
    context = 'context',
    user = 'user',
    assistant = 'assistant',
    tool = 'tool'
}

export interface MessageRegular {
    role: Role,
    content: string,
    sessionId: string
};

export type UserMessage = Omit<MessageRegular, 'role'> & { role: Role.user };
export type SystemMessage = Omit<MessageRegular, 'role'> & { role: Role.system };
export type ContextMessage = Omit<MessageRegular, 'role'> & { role: Role.context };
export type AssistantMessage = Omit<MessageRegular, 'role'> & { role: Role.assistant };
export type ToolMessage = Omit<MessageRegular, 'role'> & { role: Role.user, tool_call_id: string };
export type MessageAPI = Omit<MessageRegular, 'sessionId'>;
export type Message = (UserMessage | SystemMessage | ContextMessage | AssistantMessage | ToolMessage | MessageRegular | MessageAPI); // universal Message Type
export type MessageDB = Message & { createdAt: Date };

export enum ContentType {
    answer = 'answer',
    thought = 'thought',
    tool_call = 'tool_call',
    unidentified = 'unidentified'
}

export const MessageContentSchema = z.object({
    role: z.string(),
    content: z.object({
        tool_call: z.array(z.object(
            {
                id: z.string(),
                type: z.string(),
                function: z.string(),
                arguments: z.record(z.string(), z.unknown())
            }
        )).optional(),
        thought: z.string().optional(),
        answer: z.string().optional()
    })
});

export type MessageContent = z.infer<typeof MessageContentSchema>;

export const ToolRawResultSchema = z.object({
    id: z.string(),
    name: z.string(),
    arguments:z.record(z.string() , z.string()),
    result: z.object({
        content:z.array(z.object({type:z.enum(['text']) , text:z.string()}))
    })
});

// export interface CleanedMessage {
//     role: Role,
//     content: string,
//     createdAt: number | null
//     isThougt?: boolean
// }

export const CleanedMessageSchema = z.object({
    role:z.enum(Role),
    content: z.string(),
    createdAt: z.number().nullable(),
    isThought: z.boolean().default(false).optional()
})

export const CleanedMessageArraySchema = z.array(CleanedMessageSchema);

export type CleanedMessage = z.infer<typeof CleanedMessageSchema>;