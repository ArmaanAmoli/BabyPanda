import { Hono } from 'hono';
import {
  getMessages,
  createSession,
  addProvider,
  getSessionsByProjectDirectory,
} from '@baby-panda/db';
import { BabyPandaAgent } from '@baby-panda/agent';
import { cleanMessageHistroy } from './utils/cleanMessageHistory';
import { websocketHandler } from './webSocket';
import type { WSContext } from 'hono/ws';
import { websocket } from '@hono/bun';

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
    const result = await cleanMessageHistroy(messages);
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
  const sessions = await getSessionsByProjectDirectory(cwd);
  return new Response(JSON.stringify(sessions), {
    status: 201,
    statusText: 'Created',
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
  try {
    await addProvider({
      key: body.key,
      provider: body.provider,
      endpoint: body.endpoint,
    });
    return new Response('Provider Added', {
      status: 201,
      statusText: 'Created',
    });
  } catch (err) {
    return new Response(`Unable to add provider ${err}`, {
      status: 500,
      statusText: 'Internal Server Error',
    });
  }
});

export type HonoAppType = typeof app;
export default {
  port: serverPort,
  fetch: app.fetch,
  websocket,
};
