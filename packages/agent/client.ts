import axios, { type AxiosResponse } from 'axios';
import { setTimeout } from 'node:timers/promises';
// import type { Message } from '@baby-panda/types';
import type { MessagesArray, ReasoningEffort } from '@baby-panda/types';
import { LogType } from '@baby-panda/types';
import { getProjectName, writeLogs } from '@baby-panda/utils';
import type { UrlApi } from './types'; // verbatimModuleSyntax
import { tools } from './config/tools';

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
    reasoningEffort: ReasoningEffort,
    isRetrying: boolean,
    retrysDone: number,
  ): Promise<ChatCompletionArgs> {
    const startedAt = Date.now();
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
      data: {
        model,
        messages,
        tools,
        temperature: 0.5,
        top_p: 1,
        max_tokens: 8192,
        frequency_penalty: 0,
        presence_penalty: 0,
        reasoning_effort: reasoningEffort,
        stream: true,
        stream_options: { include_usage: true },
        tool_choice: 'auto',
      },
    };
    try {
      await logClientEvent(this.sessionId, 'request started', {
        attempt,
        model,
        reasoningEffort,
        url: this.url,
        messageCount: messages.length,
        messageRoles: messages.map((message) => message.role),
        requestBytes: Buffer.byteLength(JSON.stringify(options.data)),
        tools: tools.map((tool) => tool.function.name),
        messages: messages.map((message) => ({
          role: message.role,
          chars: message.content.length,
          preview:
            message.content.length > 300
              ? `${message.content.slice(0, 300)}…(+${message.content.length - 300} chars)`
              : message.content,
        })),
      });
      if (isRetrying) retrysDone += 1;
      const response = await axios(options);
      await logClientEvent(this.sessionId, 'response stream opened', {
        attempt,
        status: response.status,
        durationMs: Date.now() - startedAt,
      });
      return { response, systemError: false };
    } catch (error: unknown) {
      const details = await getErrorDetails(error);
      await logClientEvent(this.sessionId, 'request failed', {
        attempt,
        durationMs: Date.now() - startedAt,
        model,
        reasoningEffort,
        messageCount: messages.length,
        messageRoles: messages.map((message) => message.role),
        requestBytes: Buffer.byteLength(JSON.stringify(options.data)),
        ...details,
      });
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
        await logClientEvent(this.sessionId, 'backoff before retry', {
          attempt,
          delayMs,
          status: status ?? null,
          code: error.code ?? null,
        });
        await setTimeout(delayMs);
      }
      if (!isRetrying && retrysDone === 0) {
        isRetrying = true;
      }
      if (isRetrying && retrysDone < this.maxRetrys) {
        await logClientEvent(this.sessionId, 'scheduling retry', {
          failedAttempt: attempt,
          nextAttempt: attempt + 1,
          maxRetrys: this.maxRetrys,
        });
        return await this._attempt(messages, model, reasoningEffort, true, retrysDone);
      } else {
        if (retrysDone >= this.maxRetrys) {
          await logClientEvent(this.sessionId, 'maximum retry attempts reached', {
            model,
            attempts: attempt,
          });
        }
      }
      return { systemError: true, error };
    }
  }

  async chatCompletion(
    messages: MessagesArray,
    model: string,
    reasoningEffort: ReasoningEffort,
  ): Promise<ChatCompletionArgs> {
    return await this._attempt(messages, model, reasoningEffort, false, 0);
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

async function logClientEvent(sessionId: string, event: string, details: Record<string, unknown>) {
  await writeLogs(
    LogType.agent,
    getProjectName(),
    sessionId,
    `[BabyPandaClient] ${event} ${JSON.stringify(details)}`,
  );
}

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
