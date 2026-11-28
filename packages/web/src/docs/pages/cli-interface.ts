import type { DocPage } from '../types';

const page: DocPage = {
  slug: 'cli/interface',
  group: 'CLI',
  category: 'CLI',
  title: 'Interface',
  subtitle: 'How the terminal renders a run: streaming, reasoning, tool calls and diffs.',
  blocks: [
    {
      kind: 'p',
      text: 'The interface is one screen with three regions: the chat area, the prompt box, and a single status row under it. Which component reacts to a key is decided by **focus** — `Tab` moves focus between the chat area and the prompt box, and a component only listens while it holds focus.',
    },
    { kind: 'heading', level: 2, text: 'Streaming output' },
    {
      kind: 'p',
      text: 'The server forwards every chunk the provider produces over the WebSocket, and the terminal renders it as it lands. Answer text and reasoning text are separate streams: reasoning is drawn as a collapsible block that keeps its place in the transcript, so a long thought never pushes the answer off screen.',
    },
    {
      kind: 'p',
      text: 'Rendering is incremental — Ink repaints only what changed — so a fast stream does not flicker. The chat area is virtualised: only the rows inside the viewport are drawn, however long the conversation gets.',
    },
    { kind: 'heading', level: 2, text: 'Reasoning display' },
    {
      kind: 'p',
      text: 'A reasoning block is marked with `∴` once it is finished and with a spinner while it is still streaming. `Space` on a focused block expands or collapses it. Reasoning is never mixed into the answer text, and it is not persisted as part of the assistant message the provider sees on the next turn.',
    },
    { kind: 'heading', level: 2, text: 'Tool calls' },
    {
      kind: 'p',
      text: 'Tool calls render as bullets. A batch of several calls in one assistant message folds into a square `■ N tools` root; a batch of one flattens to a lone `●`. Each bullet is a status-coloured dot plus a verb and a dim target:',
    },
    {
      kind: 'code',
      lang: 'text',
      code: '■ 3 tools\n  ● read   packages/agent/agent.ts\n  ● grep   pattern=compaction\n  ● shell  bun --version',
    },
    {
      kind: 'p',
      text: 'Status lives entirely in the dot’s colour, so a green or red pixel always answers "did this succeed?" and never appears in the text. `Space` on a focused bullet expands that call’s detail; the mouse can click a bullet or a header row to do the same.',
    },
    {
      kind: 'table',
      head: ['Dot', 'Meaning'],
      rows: [
        ['Yellow', 'Running, or waiting for a permission decision'],
        ['Green', 'Finished successfully'],
        ['Red', 'Failed, or was denied'],
      ],
    },
    { kind: 'heading', level: 2, text: 'Diffs for write and edit calls' },
    {
      kind: 'p',
      text: 'A `write` or `edit` call expands into a unified diff with a line-number gutter. Added lines are green on a dark green tint, removed lines red on a dark red tint, and context lines stay neutral. Long diffs collapse unchanged regions into a gap row rather than scrolling them past.',
    },
    {
      kind: 'code',
      lang: 'text',
      code: '  216 │ export class BabyPandaAgent extends EventEmitter {\n  217 │   client: BabyPandaClient;\n+ 218 │   private sandbox = false;\n  219 │',
    },
    {
      kind: 'p',
      text: 'Wheel scrolling chains outwards: once the innermost region under the cursor is exhausted, the remainder passes to the next one out, so a diff scrolled to its end hands the rest of the wheel to the chat.',
    },
    { kind: 'heading', level: 2, text: 'Keyboard shortcuts' },
    {
      kind: 'p',
      text: 'Focus decides who listens: `Tab` moves between the chat area and the prompt box, and a component only reacts while it holds focus. The full table — every editing, scrolling, chat, menu and mouse binding, each checked against the source — lives in [Keyboard shortcuts](#/cli/shortcuts).',
    },
    { kind: 'heading', level: 2, text: 'Slash commands' },
    {
      kind: 'p',
      text: 'Typing `/` opens a menu that filters as you type, listing the built-in commands and every model-visible skill. What each one does, what it persists and what it does not is in [Slash commands](#/cli/slash-commands).',
    },
    { kind: 'heading', level: 2, text: 'Pasting' },
    {
      kind: 'p',
      text: 'Pastes arrive through bracketed paste mode. A paste that would occupy more than two visual rows collapses into a single chip such as `[Pasted text #1 · 159 lines · 2.4 KB]`; pasting identical content again expands the most recent chip back into its text. A collapsed chip is atomic — the cursor cannot come to rest inside one, and one `Backspace` removes it whole.',
    },
    {
      kind: 'p',
      text: '`Ctrl+O` reads a clipboard image and inserts it as a one-row chip such as `[🖼 image-1.png · 1920×1080 · 1.2 MB]`. The reader is Linux/WSL-only and tries `wl-paste`, then `xclip`, then `powershell.exe` through WSL interop. Submitting sends the message as text plus image parts; nothing is written to disk.',
    },
  ],
};

export default page;
