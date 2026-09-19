import { z } from 'zod';

export enum Role{
    system = 'system',
    context = 'context',
    user = 'user',
    assistant = 'assistant'
};
export enum MessageQueueSpecialElement{
  toolCallDone = 'tool-call-done',
  errorInLastIteration = 'error-in-last-iteration',
  lastReplyFromLLMWasEmpty = 'last-reply-from-llm-was-empty',
  lastReplyFromLLMWasThought = 'last-reply-from-llm-was-thought'
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

export const ReplyJsonSchema = z.object({
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
            content: z.string().optional()
          })
        });

export type ReplyJson = z.infer<typeof ReplyJsonSchema>;