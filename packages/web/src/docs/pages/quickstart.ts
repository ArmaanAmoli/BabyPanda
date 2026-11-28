import type { DocPage } from '../types';

const page: DocPage = {
  slug: 'quickstart',
  group: 'Get started',
  category: 'Get started',
  title: 'Quickstart',
  subtitle: 'Your first session, your first prompt, and what happens while you wait.',
  blocks: [
    { kind: 'heading', level: 2, text: 'Start a session' },
    {
      kind: 'p',
      text: 'Run `babypanda` with no arguments inside the directory you want to work on. BabyPanda starts its local server in-process, creates a session bound to that directory, and opens the terminal UI.',
    },
    {
      kind: 'code',
      lang: 'bash',
      code: 'cd ~/projects/my-app\nbabypanda',
    },
    {
      kind: 'p',
      text: 'The first run asks for a provider API key. Pick the provider from the menu, paste the key, and it is stored in the local database — never in a file you have to manage, and never in the repository.',
    },
    {
      kind: 'callout',
      variant: 'note',
      title: 'Ports',
      text: 'The in-process server picks the first free port from 3500 upward, so several terminals can run at once. Set `BABY_PANDA_PORT` only when you need a fixed port.',
    },
    { kind: 'heading', level: 2, text: 'Send a prompt' },
    {
      kind: 'p',
      text: 'Type into the prompt box at the bottom and press `Enter`. `Ctrl+J` inserts a newline; `Ctrl+O` pastes an image from the clipboard as a chip.',
    },
    {
      kind: 'code',
      lang: 'text',
      code: '> Summarise what this repository does, in five bullet points.',
    },
    {
      kind: 'p',
      text: 'The status bar shows the session id, its name, the provider, the model, the reasoning effort and how much of the context window is in use.',
    },
    { kind: 'heading', level: 2, text: 'What happens during a run' },
    {
      kind: 'p',
      text: 'The agent loop runs until the model stops asking for tools. Each turn goes through the same sequence:',
    },
    {
      kind: 'list',
      ordered: true,
      items: [
        'Your message is queued, persisted to SQLite and pushed onto the in-memory history.',
        'The context is assembled: system instructions, project memory, `AGENT.md`/`BABYPANDA.md` if present, the available skills, the compaction summary and the message history.',
        'The request is streamed to the provider. Answer text and reasoning text arrive as separate streams and are rendered as they land.',
        'If the model asks for a tool, the agent emits a permission event and waits. You choose **Allow**, **Don\u2019t Allow** or **Always Allow** — or press `Escape`, which is the same as Don\u2019t Allow.',
        'Allowed tools run through the MCP client, their results are persisted and sent back to the model, and the loop continues.',
        'When the model answers without requesting a tool, the loop ends and the status bar stops spinning.',
      ],
    },
    { kind: 'heading', level: 3, text: 'Reading the transcript' },
    {
      kind: 'p',
      text: 'Assistant text is marked with `◆`, your own messages with `>`, tool calls with `●` and skill injections with `⚡`. Reasoning is a collapsible block; a batch of tool calls folds into one `■ N tools` root that expands to the individual calls.',
    },
    {
      kind: 'code',
      lang: 'text',
      code: '◆ I’ll start by reading the entry point.\n● read  packages/agent/agent.ts\n   ┌─ 216  export class BabyPandaAgent extends EventEmitter {\n● shell bun --version\n   1.4.2\n\n◆ This repository is a Bun workspace monorepo…',
    },
    { kind: 'heading', level: 2, text: 'Approve or deny a tool call' },
    {
      kind: 'p',
      text: 'A permission prompt is modal: it takes the keyboard until you answer it. `↑`/`↓` or `j`/`k` move the selection, `Enter` confirms, and `1`–`3` pick an option directly.',
    },
    {
      kind: 'table',
      head: ['Option', 'Effect'],
      rows: [
        ['Allow', 'Runs this call only.'],
        ['Always Allow', 'Runs this and every later `shell` call in this session.'],
        ['Don\u2019t Allow', 'The call is refused and the reason is sent back to the model.'],
      ],
    },
    {
      kind: 'callout',
      variant: 'warning',
      title: 'Read the command',
      text: 'The permission box shows the exact command or file path. A shell call can do anything your user can do, so treat the prompt as the last line of defence.',
    },
    { kind: 'heading', level: 2, text: 'End the session' },
    {
      kind: 'p',
      text: '`Ctrl+C` exits. BabyPanda closes the database, restores the terminal and prints a farewell banner carrying the session id, so you can pick the conversation back up later with `babypanda open <session-id>`.',
    },
    {
      kind: 'code',
      lang: 'bash',
      code: 'babypanda list            # find the session id\nbabypanda open 01M77HW    # resume it (a unique prefix is enough)',
    },
  ],
};

export default page;
