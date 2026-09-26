import { z } from 'zod';
import type {Message} from '@baby-panda/types';

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
