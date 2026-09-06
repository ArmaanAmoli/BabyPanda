export interface PromptBoxArgs{
    placeholder:string,
    value:string,
    onSubmit:()=>void,
    onChange:(value:string)=>void,
}
export enum Role{
    system = 'system',
    context = 'context',
    user = 'user',
    assistant = 'assistant',
    tool = 'tool'
}
interface MessageRegular{
    role:Role,
    content:unknown,
    sessionId:string,
    index?:number
}
export type UserMessage = Omit<MessageRegular,'role'> & {role:Role.user}
export type SystemMessage = Omit<MessageRegular,'role'> & {role:Role.system}
export type ContextMessage = Omit<MessageRegular,'role'> & {role:Role.context}
export type AssistantMessage = Omit<MessageRegular,'role'> & {role:Role.assistant}
export type ToolMessage = Omit<MessageRegular,'role'> & {role:Role.tool , tool_call_id:string}
export type Message = (UserMessage | SystemMessage | ContextMessage | AssistantMessage | ToolMessage)// universal Message Type
export type MessageDB = Message & {createdAt:Date};

export interface APIProvider {
    provider: string;
    endpoint: string;
    key: string;
}
export interface Session{
    id: string;
    createdAt: Date | null;
    parentSessionId: string | null;
    messagesCount: number | null;
}
export interface ReactChildPropInterface{
    children: React.ReactNode
}
export type MessageStatusElement = Message & {sended:boolean};

export interface MessageQueueElement{
    message : MessageStatusElement,
    setMessage : (newMessage:MessageStatusElement)=>void
}
export interface MessageQueueState{
    queue:MessageQueueElement[],
    setQueue: (value:MessageQueueElement)=>void,
}