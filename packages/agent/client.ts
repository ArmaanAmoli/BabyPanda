import axios, { type AxiosResponse } from 'axios';
import { setTimeout } from 'node:timers/promises';
// import type { Message } from '@baby-panda/types';
import {
  Role,
  type AssistantMessage,
  type MessagesArray,
  type ReasoningEffort,
  type SystemMessage,
  type ToolMessage,
} from '@baby-panda/types';
import type { UrlApi } from './types'; // verbatimModuleSyntax
import { baseTools, type ModelTool } from './config/tools';
import { type ProvidersEnum } from './config/models';
import getModelDetails from './services/getModelDetails';
import { toApiMessages } from './utils/cleanMessages';

/** One text part of a multimodal `content` array. */
// type TextPart = { type: 'text'; text: string };

/** A user message whose `content` is the parts array kimi-k3.1-pro expects. */
// type TextPartMessage = { role: Role.user; content: TextPart[] };

/**
 * Rewrites user messages into the `[{ type: 'text', text }]` parts form.
 *
 * Only `user` messages are converted: NVIDIA's kimi-k3.1-pro schema states the
 * object list format is not supported for `system` and `assistant` roles, and
 * tool results stay plain text. Image parts are deliberately not produced --
 * image support is not wired up yet.
 */
// function toTextPartMessages(messages: MessagesArray): (MessagesArray[number] | TextPartMessage)[] {
//   return messages.map((message) => {
//     if (message.role !== Role.user) return message;
//     const parts: TextPart[] = [{ type: 'text', text: message.content }];
//     return { role: Role.user, content: parts };
//   });
// }

/** One part of a provider-facing user `content` array. */
type ProviderContentPart =
  { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

/** A user message as the provider sees it: text or OpenAI-style parts. */
type ProviderUserMessage = {
  role: Role.user;
  content: string | ProviderContentPart[];
};

/** The request's message list with user content in the provider's shape. */
export type ProviderMessagesArray = (
  AssistantMessage | ToolMessage | SystemMessage | ProviderUserMessage
)[];

/**
 * Converts internal message content to the provider's wire shape.
 *
 * Internally (WebSocket + DB) an image part is `{type:'image', image}` with a
 * data URL; OpenAI-compatible endpoints, NVIDIA's included, expect
 * `{type:'image_url', image_url:{url}}`. Text-only messages pass through
 * untouched. A model whose details do not mark it multimodal cannot receive
 * image parts at all, which is rejected here with a readable error rather
 * than left to the provider's own (often opaque) rejection.
 */
export function toProviderMessages(
  messages: MessagesArray,
  multimodal: boolean,
  model: string,
): ProviderMessagesArray {
  return messages.map((message): ProviderMessagesArray[number] => {
    if (message.role !== Role.user) return message;
    if (typeof message.content === 'string') {
      return { role: Role.user, content: message.content };
    }

    const parts: ProviderContentPart[] = message.content.map((part) => {
      if (part.type === 'text') return { type: 'text', text: part.text };
      if (!multimodal) {
        throw new Error(
          `Model ${model} does not support image input. Remove the image or switch to a multimodal model.`,
        );
      }
      return { type: 'image_url', image_url: { url: part.image } };
    });

    return { role: Role.user, content: parts };
  });
}

/**
 * Builds the body of one chat-completion request.
 *
 * Every model here shares the OpenAI-compatible shape except kimi-k3.1-pro:
 * NVIDIA pins its temperature at 0.95 and its schema rejects any field it does
 * not document, so the sampling fields are dropped for it and its user
 * messages carry `content` as text parts instead of a plain string.
 */
function buildRequestBody(
  messages: MessagesArray,
  model: string,
  provider: ProvidersEnum,
  reasoningEffort: ReasoningEffort,
  requestTools: ModelTool[],
): Record<string, unknown> {
  const modelDetails = getModelDetails(provider, model);
  const data: Record<string, unknown> = {
    model,
    // Every message is first reduced to the fields its role's schema defines
    // (the live loop holds rich tool records — success, before, stats, ... —
    // and some endpoints reject messages with extra keys), then image parts
    // are converted to the provider's image_url shape.
    messages: toProviderMessages(toApiMessages(messages), modelDetails.multimodal, model),
    tools: requestTools,
    max_tokens: 8192,
    stream: true,
    stream_options: { include_usage: true },
    reasoning_effort: reasoningEffort,
  };
  if (modelDetails.supportsOpenAiExtensions) {
    data.temperature = 0.5;
    data.top_p = 1;
    data.frequency_penalty = 0;
    data.presence_penalty = 0;
    data.tool_choice = 'auto';
  }
  return data;
}

interface ChatCompletionArgs {
  response?: AxiosResponse;
  systemError?: boolean;
  error?: unknown;
}
class BabyPandaClient {
  url: string;
  apikey: string;
  token: string;
  sessionId: string;
  private maxRetrys: number;
  private options = {};
  constructor({ url, apikey }: UrlApi, sessionId: string) {
    this.url = url;
    this.apikey = apikey;
    this.sessionId = sessionId;
    this.token = 'Bearer ' + apikey;
    this.maxRetrys = 3;
  }
  setApiKey(apikey: string) {
    this.apikey = apikey;
    this.token = 'Bearer ' + apikey;
  }
  setEndpoint(url: string) {
    this.url = url;
  }
  private async _attempt(
    messages: MessagesArray,
    model: string,
    provider: ProvidersEnum,
    reasoningEffort: ReasoningEffort,
    isRetrying: boolean,
    retrysDone: number,
    requestTools: ModelTool[] = baseTools,
  ): Promise<ChatCompletionArgs> {
    const attempt = retrysDone + 1;
    const options = {
      method: 'POST' as const,
      url: this.url,
      responseType: 'stream' as const,
      headers: {
        accept: 'text/event-stream',
        'content-type': 'application/json',
        authorization: this.token,
      },
      // Axios `timeout` only bounds the wait for response headers, which is
      // exactly what busy inference queues hold for minutes. Once the stream
      // starts flowing, inactivity is guarded separately in the agent loop.
      timeout: 600_000,
      data: buildRequestBody(messages, model, provider, reasoningEffort, requestTools),
    };
    try {
      if (isRetrying) retrysDone += 1;
      const response = await axios(options);
      return { response, systemError: false };
    } catch (error: unknown) {
      const details = await getErrorDetails(error);
      if (axios.isAxiosError(error)) {
        if (error.code === 'ERR_NETWORK') {
          return { systemError: true, error: 'No internet' };
        }
        if (error.response?.status === 401) {
          return { systemError: true, error: 'Wrong API key' };
        }
        const status = error.response?.status;
        // No response at all (timeouts, ECONNRESET, aborted streams), rate
        // limits, request timeouts and server-side (5xx) errors are transient,
        // especially when the inference queue is busy. Everything else
        // (4xx validation errors like 400/404, auth) is deterministic and
        // must not be retried.
        const retriable = status == null || status === 429 || status === 408 || status >= 500;
        if (!retriable) {
          return { systemError: true, error: details.responseBody };
        }
        // Rate limits get a fixed cool-down; every other transient failure
        // backs off linearly with the attempt number (5s, 10s, 15s, capped at
        // 30s) so retries do not hammer a queue that is already congested.
        const delayMs = status === 429 ? 5_000 : Math.min(30_000, 5_000 * attempt);
        await setTimeout(delayMs);
      }
      if (!isRetrying && retrysDone === 0) {
        isRetrying = true;
      }
      if (isRetrying && retrysDone < this.maxRetrys) {
        return await this._attempt(
          messages,
          model,
          provider,
          reasoningEffort,
          true,
          retrysDone,
          requestTools,
        );
      }
      return { systemError: true, error };
    }
  }

  async chatCompletion(
    messages: MessagesArray,
    model: string,
    provider: ProvidersEnum,
    reasoningEffort: ReasoningEffort,
    requestTools: ModelTool[] = baseTools,
  ): Promise<ChatCompletionArgs> {
    return await this._attempt(messages, model, provider, reasoningEffort, false, 0, requestTools);
  }
}

const getErrorDetails = async (error: unknown) => {
  if (!axios.isAxiosError(error)) {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  const responseBody = await getResponseBody(error);
  return {
    code: error.code,
    message: error.message,
    status: error.response?.status,
    statusText: error.response?.statusText,
    responseHeaders: error.response?.headers,
    responseBody,
  };
};

const getResponseBody = async (error: import('axios').AxiosError): Promise<string> => {
  const response = error.response;
  if (!response) return error.message;

  const data = response.data as unknown;
  if (!isReadableResponse(data)) {
    return JSON.stringify(data);
  }

  return new Promise<string>((resolve) => {
    const chunks: Buffer[] = [];
    data.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    data.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    data.on('error', (streamError: unknown) =>
      resolve(`Unable to read error response: ${String(streamError)}`),
    );
  });
};

function isReadableResponse(value: unknown): value is {
  on(event: 'data' | 'end' | 'error', listener: (...args: never[]) => void): void;
} {
  return (
    typeof value === 'object' && value !== null && 'on' in value && typeof value.on === 'function'
  );
}

export { BabyPandaClient };
