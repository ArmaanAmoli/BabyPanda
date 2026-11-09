// import type { Message } from '@baby-panda/types';
// import { z } from 'zod';

export enum MessageQueueEvents {
  toolCallDone = 'tool-call-done',
  errorInLastIteration = 'error-in-last-iteration',
  lastReplyFromLLMWasEmpty = 'last-reply-from-llm-was-empty',
  lastReplyFromLLMWasThought = 'last-reply-from-llm-was-thought',
  answerMessageBreakPreventer = 'answer-message-break-preventer',
}

export interface UrlApi {
  url: string;
  apikey: string;
}
export interface Tool {
  id: string;
  name: string;
  arguments: { [x: string]: unknown } | undefined;
}
export type ToolResult = Tool & { result?: unknown; error?: string };

export type FinishReason = 'length' | 'stop' | 'tool_calls' | 'content_filter' | null;
