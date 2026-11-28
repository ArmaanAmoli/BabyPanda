import type { DocPage } from '../types';

const page: DocPage = {
  slug: 'architecture',
  group: 'Architecture',
  category: 'Architecture',
  title: 'Architecture',
  subtitle: 'A Bun workspace monorepo, one agent loop, and a WebSocket in the middle.',
  blocks: [
    {
      kind: 'p',
      text: 'BabyPanda is a Bun workspace monorepo written in TypeScript. Seven packages, one dependency direction: the CLI starts the server, the server owns the agent, the agent owns the model client and the MCP tools, and everything persists through the database package.',
    },
    { kind: 'heading', level: 2, text: 'Monorepo layout' },
    {
      kind: 'table',
      head: ['Package', 'Responsibility'],
      rows: [
        [
          '`packages/cli`',
          'Ink/React terminal interface, session startup, WebSocket client, permissions and streamed message rendering',
        ],
        [
          '`packages/server`',
          'Hono HTTP routes, WebSocket upgrade handling, agent lifecycle and event forwarding',
        ],
        [
          '`packages/agent`',
          'NVIDIA chat client, agent loop, context construction, MCP integration, memory, compaction and tool permissions',
        ],
        ['`packages/db`', 'Drizzle schema, SQLite connection, migrations and persistence methods'],
        ['`packages/types`', 'Shared TypeScript types, enums and Zod validation schemas'],
        ['`packages/utils`', 'Cross-package helpers: project naming, log writing, skills'],
        ['`packages/web`', 'Landing page and this documentation site: React + Vite + Tailwind CSS'],
      ],
    },
    {
      kind: 'p',
      text: 'The CLI depends on the server, the server on the agent, and the agent on the database and the utils. `packages/types` is a leaf that everything reads; nothing in the graph depends on the web package.',
    },
    { kind: 'heading', level: 2, text: 'The agent loop' },
    {
      kind: 'p',
      text: '`BabyPandaAgent` is an `EventEmitter` with a message queue. The loop drains one queued event at a time, and each iteration either compacts, streams a request, or runs the tools the model asked for.',
    },
    {
      kind: 'code',
      lang: 'text',
      code: 'queue an event\n  │\n ├─ context used ≥ 75%?  ──yes──▶ compact, rebuild context, reset counter\n  │                              (then loop again)\n  │\n  ├─ stream chatCompletion(messages, model, provider, effort)\n  │     ├─ content chunks        ──▶ emit `content`\n  │     ├─ reasoning chunks      ──▶ emit `reasoning_content`\n  │     └─ tool_calls            ──▶ emit `tool_call`\n  │\n  └─ for each requested tool\n        ├─ emit `permission`, wait for the decision\n        ├─ run it through the MCP client\n        ├─ persist the result as a `tool` message\n        └─ loop again with the result appended',
    },
    {
      kind: 'p',
      text: 'The loop ends when the model answers without requesting a tool. Two internal queue events handle the edge cases: one retries after an error in the previous iteration, and one re-asks when the model’s reply came back empty.',
    },
    { kind: 'heading', level: 2, text: 'The server' },
    {
      kind: 'p',
      text: 'The server is a Hono app. It exposes a handful of JSON endpoints for the things the terminal needs outside the stream, and one WebSocket for everything inside it.',
    },
    {
      kind: 'table',
      head: ['Method', 'Path', 'Purpose'],
      rows: [
        ['`POST`', '`/start-session`', 'Create and return a new session id'],
        ['`POST`', '`/get-session`', 'List the sessions for the current project directory'],
        ['`POST`', '`/get-session-name`', 'Return a session’s name'],
        ['`POST`', '`/rename-session`', 'Rename a session'],
        ['`POST`', '`/get-messages`', 'Return the cleaned message history'],
        ['`POST`', '`/add-provider`', 'Store provider data'],
        ['`GET`', '`/providers`', 'The provider catalogue, merged with saved keys'],
        ['`GET`', '`/web-api-keys`', 'Which web keys are configured'],
        ['`GET`', '`/ws?sessionId=…`', 'Upgrade to the streamed event socket'],
      ],
    },
    {
      kind: 'callout',
      variant: 'warning',
      title: 'TODO — streaming is a WebSocket, not SSE',
      text: 'The brief described SSE streaming endpoints. The implementation streams over a WebSocket at `GET /ws`: the agent’s events are forwarded as JSON envelopes tagged with an `eventType`, and the CLI sends prompts, settings and permission decisions back over the same socket. There is no server-sent-events route.',
    },
    {
      kind: 'p',
      text: 'On connect, the server looks up the session’s agent or creates one, restores its model settings, and attaches listeners for every event the agent can emit: content, reasoning, tool calls, tool results, permission requests, skill activations, compaction state and context updates.',
    },
    { kind: 'heading', level: 2, text: 'The CLI' },
    {
      kind: 'p',
      text: 'The CLI is the primary entry point. It runs the system commands first — before the terminal is reconfigured and before the server starts, so they never inherit the alternate screen buffer or a WebSocket — then starts the server in-process, creates a session if one was not supplied, and renders the Ink UI.',
    },
    {
      kind: 'p',
      text: 'The UI is a tree of context providers (terminal, mouse, scroll, session, message history, permissions, viewport, tool calls, settings) feeding three regions: the chat area, the prompt box and the status bar.',
    },
    { kind: 'heading', level: 2, text: 'Persistence' },
    {
      kind: 'p',
      text: 'SQLite through Drizzle. Three tables carry the whole state:',
    },
    {
      kind: 'table',
      head: ['Table', 'Holds'],
      rows: [
        [
          '`session`',
          'One row per conversation: id, directory, name, message count, tokens, model settings',
        ],
        ['`message`', 'One row per message: session id, role, content, sequence'],
        ['`api_keys`', 'One row per credential: provider, endpoint, key, type'],
      ],
    },
    {
      kind: 'p',
      text: "`message.session_id` references `session.id` with `onDelete: 'cascade'`, so deleting a session takes its messages with it. Migrations live in `packages/db/drizzle` and are applied on startup by the CLI.",
    },
    { kind: 'heading', level: 2, text: 'How a request flows' },
    {
      kind: 'list',
      ordered: true,
      items: [
        'You press `Enter`; the CLI sends a `message` event over the WebSocket.',
        'The server queues it on the session’s agent.',
        'The agent persists it, rebuilds nothing (the history is already in memory), and streams a chat-completion request to the provider.',
        'Chunks come back and are forwarded to the CLI, which renders them as they land.',
        'If the model asks for a tool, a permission event goes out and the agent waits for the decision.',
        'The tool runs, its result is persisted as a `tool` message, and the loop continues.',
      ],
    },
  ],
};

export default page;
