export enum Role{
    system = 'system',
    context = 'context',
    user = 'user',
    assistant = 'assistant'
};
export enum MessageQueueSpecialElement{
  toolCallDone = 'tool-call-done',
  errorInLastIteration = 'error-in-last-iteration'
};
export interface MessageRegular{
    role:Role,
    content:unknown,
    sessionId:string
};
export type UserMessage = Omit<MessageRegular,'role'> & {role:Role.user};
export type SystemMessage = Omit<MessageRegular,'role'> & {role:Role.system};
export type ContextMessage = Omit<MessageRegular,'role'> & {role:Role.context};
export type AssistantMessage = Omit<MessageRegular,'role'> & {role:Role.assistant};
export type ToolMessage = Omit<MessageRegular,'role'> & {role:Role.user , tool_call_id:string};
export type MessageAPI = Omit<MessageRegular , 'sessionId'>;
export type Message = (UserMessage | SystemMessage | ContextMessage | AssistantMessage | ToolMessage | MessageRegular | MessageAPI); // universal Message Type
export enum ReasoningEffort{
    none = 'none',
    high = 'high',
    max = 'max'
};
export interface UrlApi{
    url:string,
    apikey:string,
};
export type MessageQueueMessage = Message & {isResponded:boolean | false}
export interface Tool{
    id:string
    name:string;
    arguments:{[x:string]:unknown} | undefined;
};
export type ToolResult = Tool & {result?:unknown , error?:string};