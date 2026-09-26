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