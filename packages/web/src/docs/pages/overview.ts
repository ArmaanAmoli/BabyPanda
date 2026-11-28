import type { DocPage } from '../types';

const page: DocPage = {
  slug: 'overview',
  group: 'Get started',
  category: 'Get started',
  title: 'Overview',
  subtitle: 'What BabyPanda is, who it is for, and what it deliberately does not do.',
  blocks: [
    {
      kind: 'p',
      text: 'BabyPanda is a terminal-based autonomous coding agent. You give it a task in plain language, it reads your repository, proposes the file edits and shell commands it wants to run, and streams the result back into your terminal. Nothing happens without your approval.',
    },
    { kind: 'heading', level: 2, text: 'What BabyPanda is' },
    {
      kind: 'p',
      text: 'It combines five things that usually live in separate products: an interactive terminal UI, a local HTTP and WebSocket server, a streaming LLM agent loop, MCP tools for touching the filesystem and the web, and a persistent conversation history in SQLite.',
    },
    {
      kind: 'list',
      items: [
        '**Terminal UI** — an Ink/React interface that renders streamed output, reasoning, tool calls and inline diffs.',
        '**Local server** — a Hono app that owns the agent lifecycle and forwards every event to the terminal over a WebSocket.',
        '**Agent loop** — builds the context, calls the model, runs the tools it asks for, and repeats until the answer is complete.',
        '**MCP tools** — filesystem, shell, web search, web fetch, notes, memory and skills, all over an in-memory stdio transport.',
        '**Persistence** — every message, session and provider key is stored in a local SQLite database.',
      ],
    },
    {
      kind: 'callout',
      variant: 'note',
      title: 'Local first',
      text: 'BabyPanda assumes a local filesystem, a local SQLite database and a local terminal. There is no hosted service, no account and no telemetry.',
    },
    { kind: 'heading', level: 2, text: 'Who it is for' },
    {
      kind: 'p',
      text: 'Developers who already live in a terminal and want a second pair of hands on a repository-sized task: reading unfamiliar code, applying a mechanical change across many files, or summarising what a branch actually did. It is built for people who read the diff before they accept it.',
    },
    {
      kind: 'p',
      text: 'It is **not** a replacement for reviewing your own work. The model can be wrong, and the tool will do exactly what it is told, including deleting files.',
    },
    { kind: 'heading', level: 2, text: 'What a session looks like' },
    {
      kind: 'p',
      text: 'A session is one conversation bound to one directory. You type a prompt, the agent streams its answer, and whenever it wants to touch your machine it stops and asks:',
    },
    {
      kind: 'code',
      lang: 'text',
      code: '◆ read  packages/agent/agent.ts\n   Allow once / Always allow / Deny\n\n◆ shell bun --version\n   Allow once / Always allow / Deny',
    },
    {
      kind: 'p',
      text: 'The transcript keeps every tool call as a collapsible bullet, so a long run stays readable and you can reopen any diff after the fact.',
    },
    { kind: 'heading', level: 2, text: 'Educational purpose' },
    {
      kind: 'callout',
      variant: 'warning',
      title: 'Built to be read',
      text: 'BabyPanda is an educational project. It exists to show how a terminal agent is put together — the agent loop, the MCP boundary, the permission model, the persistence layer — and it is not hardened for production use. There is no authentication, no multi-user isolation and no deployment guide.',
    },
    { kind: 'heading', level: 2, text: 'Licence' },
    {
      kind: 'p',
      text: 'BabyPanda is released under the [MIT Licence](https://github.com/ArmaanAmoli/BabyPanda/blob/main/LICENSE). You may use, modify and redistribute it, including commercially, as long as the copyright notice and the licence text stay with it. The software is provided "as is", without warranty of any kind.',
    },
    {
      kind: 'table',
      head: ['Fact', 'Value'],
      rows: [
        ['Kind', 'Terminal-based autonomous coding agent'],
        ['Runtime', 'Bun, TypeScript, Bun workspace monorepo'],
        ['Interface', 'Ink/React terminal UI'],
        ['Server', 'Hono, HTTP + WebSocket on localhost'],
        ['Storage', 'SQLite via Drizzle, under `~/.babypanda`'],
        ['Licence', 'MIT'],
      ],
    },
  ],
};

export default page;
