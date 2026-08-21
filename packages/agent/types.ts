export enum Role{
    system = 'system',
    context = 'context',
    user = 'user',
    assistant = 'assistant'
}

interface Message{
    role:Role
    content:string
}

type userMessage = Omit<Message,'role'> & {role:Role.user}
type systemMessage = Omit<Message,'role'> & {role:Role.system}
type contextMessage = Omit<Message,'role'> & {role:Role.context}
type assistantMessage = Omit<Message,'role'> & {role:Role.assistant}

export enum ReasoningEffort{
    none = 'none',
    high = 'high',
    max = 'max'
}

export type { Message , userMessage , systemMessage , contextMessage , assistantMessage}