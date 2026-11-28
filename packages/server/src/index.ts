import { Hono } from 'hono';
import {
  getMessages,
  createSession,
  addProvider,
  getProviders,
  getWebApiKeys,
  getSessionsByProjectDirectory,
  getSessionName,
  renameSession,
} from '@baby-panda/db';
import { BabyPandaAgent } from '@baby-panda/agent';
// import { cleanMessageHistroy } from './utils/cleanMessageHistory';
import { websocketHandler } from './webSocket';
import type { WSContext } from 'hono/ws';
import { websocket } from '@hono/bun';
import { Models } from '@agent/config/models';
import { dbToAgentMessages, cleanOldLogs, resolveLogTtlDays, logError } from '@baby-panda/utils';
import { Role, type ApiKeyType, API_KEY_TYPES, LogType } from '@baby-panda/types';

const defaultPort = 3500;
const configuredPort = Number(process.env['BABY_PANDA_PORT'] ?? defaultPort);

if (!Number.isInteger(configuredPort) || configuredPort < 1 || configuredPort > 65535) {
  throw new Error('BABY_PANDA_PORT must be an integer between 1 and 65535');
}

let serverPort = configuredPort;

export function getServerPort() {
  return serverPort;
}

export function setServerPort(port: number) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('BABY_PANDA_PORT must be an integer between 1 and 65535');
  }
  serverPort = port;
}

const app = new Hono();

export const wsCollection = new Map<string, WSContext>(); // sessionID - ws object
export const agentStore = new Map<string, BabyPandaAgent>(); // sessionID - agent
const cwd = process.cwd().replaceAll('/', '-').replace('-', '');
// `createSession` stores the raw `process.cwd()`, so session lookups have to
// query with the raw path too. The mangled form above is only a log folder
// name; using it here made `/get-session` match nothing.
const projectDirectory = process.cwd();

// Keep the logs tree temporary: on every startup, delete logs older than the
// retention window. Fire-and-forget so cleanup never delays server boot.
void cleanOldLogs(resolveLogTtlDays());

app.get('/ws', async (c, next) => websocketHandler(c, next));

app.post('/get-messages', async (c) => {
  const body = await c.req.json();
  if (!body.sessionId) {
    const res = new Response('Session id not attached', {
      status: 400,
      statusText: 'Bad Request',
    });
    return res;
  }
  try {
    const messages = await getMessages(body.sessionId);
    // compaction summaries are internal agent context; never sent to the CLI
    const chatMessages = messages.filter((message) => message.role !== Role.compaction);
    const result = dbToAgentMessages(chatMessages);
    const response = JSON.stringify(result);
    return new Response(response, { status: 200, statusText: 'OK' });
  } catch (err) {
    return new Response('', {
      status: 500,
      statusText: `Server Error ${err} `,
    });
  }
});

app.post('/start-session', async () => {
  const session = await createSession();
  return new Response(session, { status: 201, statusText: 'Created' });
});

app.post('/get-session', async () => {
  const sessions = await getSessionsByProjectDirectory(projectDirectory);
  return new Response(JSON.stringify(sessions), {
    status: 201,
    statusText: 'Created',
  });
});

app.post('/get-session-name', async (c) => {
  const body = await c.req.json();
  if (!body.sessionId) {
    return new Response('Session id not attached', {
      status: 400,
      statusText: 'Bad Request',
    });
  }
  const name = await getSessionName(body.sessionId);
  if (name === null) {
    return new Response(`No session with id ${body.sessionId}`, {
      status: 404,
      statusText: 'Not Found',
    });
  }
  return new Response(JSON.stringify({ name }), { status: 200, statusText: 'OK' });
});

// The message body carries the reason, so the CLI can show it verbatim.
const RENAME_FAILURES: Record<string, { status: 400 | 404 | 409; message: string }> = {
  'not-found': { status: 404, message: 'that session no longer exists' },
  'invalid-name': {
    status: 400,
    message: 'a session name must be 1-64 characters with no control characters',
  },
  'name-taken': {
    status: 409,
    message: 'another session in this directory already has that name',
  },
};

app.post('/rename-session', async (c) => {
  const body = await c.req.json();
  if (!body.sessionId || typeof body.name !== 'string') {
    return new Response('Session id and name not attached', {
      status: 400,
      statusText: 'Bad Request',
    });
  }
  const result = await renameSession(body.sessionId, body.name);
  if (!result.ok) {
    const failure = RENAME_FAILURES[result.reason]!;
    return new Response(failure.message, {
      status: failure.status,
      statusText: failure.message,
    });
  }
  return new Response(JSON.stringify({ name: result.name }), {
    status: 200,
    statusText: 'OK',
  });
});

app.post('/add-provider', async (c) => {
  const body = await c.req.json();
  if (!(body.key && body.provider && body.endpoint)) {
    return new Response('missing data {provider , endpoint , key}', {
      status: 400,
      statusText: 'Bad Request',
    });
  }
  // Existing callers omit `type`; they are all chat-provider credentials.
  const type: ApiKeyType = body.type ?? 'model';
  if (!API_KEY_TYPES.includes(type)) {
    return new Response(`unknown api key type: ${String(body.type)}`, {
      status: 400,
      statusText: 'Bad Request',
    });
  }
  try {
    await addProvider({
      key: body.key,
      provider: body.provider,
      endpoint: body.endpoint,
      type,
    });

    return new Response('Provider Added', {
      status: 201,
      statusText: 'Created',
    });
  } catch (err) {
    // No session exists yet when a key is first saved, so the log file is
    // keyed by the endpoint rather than a session id.
    await logError(LogType.server, cwd, 'add-provider', 'unable to save api key', err);
    return new Response(`Unable to add provider ${err}`, {
      status: 500,
      statusText: 'Internal Server Error',
    });
  }
});

app.get('/web-api-keys', async () => {
  const configured = await getWebApiKeys();
  return new Response(JSON.stringify(configured), { status: 200 });
});

app.get('/providers', async () => {
  const configured = await getProviders();
  const providers = Object.entries(Models).map(([provider, details]) => {
    const saved = configured.find(
      (item) => item.provider?.toLowerCase() === provider.toLowerCase(),
    );
    return {
      provider,
      endpoint: saved?.endpoint ?? `${details.url}`,
      hasKey: Boolean(saved?.hasKey),
      models: Object.entries(details.models).map(([model, modelDetails]) => ({
        model,
        contextLength: modelDetails.contextLength,
        reasoningEfforts: modelDetails.reasoningEfforts,
      })),
    };
  });
  return new Response(JSON.stringify(providers), { status: 200 });
});

export type HonoAppType = typeof app;
export default {
  port: serverPort,
  fetch: app.fetch,
  websocket,
};
