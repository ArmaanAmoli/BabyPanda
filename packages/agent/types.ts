import type {Message} from '@baby-panda/types';
import { z } from 'zod';

export enum MessageQueueSpecialElement{
  toolCallDone = 'tool-call-done',
  errorInLastIteration = 'error-in-last-iteration',
  lastReplyFromLLMWasEmpty = 'last-reply-from-llm-was-empty',
  lastReplyFromLLMWasThought = 'last-reply-from-llm-was-thought'
};

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


export const ShellCallSchema = z.object({
    command:z.string().min(1),
    timeout:z.number().int().positive().max(600_000).default(120000).optional()
});