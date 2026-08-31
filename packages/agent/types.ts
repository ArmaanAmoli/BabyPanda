export enum Role{
    system = 'system',
    context = 'context',
    user = 'user',
    assistant = 'assistant',
    tool = 'tool'
}

export interface Message{
    role:Role
    content:string
}

export type userMessage = Omit<Message,'role'> & {role:Role.user}
export type systemMessage = Omit<Message,'role'> & {role:Role.system}
export type contextMessage = Omit<Message,'role'> & {role:Role.context}
export type assistantMessage = Omit<Message,'role'> & {role:Role.assistant}

export enum ReasoningEffort{
    none = 'none',
    high = 'high',
    max = 'max'
}

export interface UrlApi{
    url:string,
    apikey:string,
}

export type MessageQueueMessage = Message & {isResponded:boolean | false}
