import type { DocPage } from '../types';

const page: DocPage = {
  slug: 'cli/shortcuts',
  group: 'CLI',
  category: 'CLI',
  title: 'Keyboard shortcuts',
  subtitle: 'Every binding in the terminal UI, and which component reacts to it.',
  blocks: [
    {
      kind: 'p',
      text: 'Which component reacts to a key is decided by **focus**. `Tab` moves focus between the chat area and the prompt box, and a component only listens while it holds focus — or, for the menus, while it is open. `Escape` drops focus entirely.',
    },
    {
      kind: 'callout',
      variant: 'note',
      title: 'Read this against the code',
      text: 'Every row below was checked against `packages/cli/src`. Where the repository’s own `docs/shortcut.md` claims a binding the code does not implement, it is called out rather than repeated.',
    },
    { kind: 'heading', level: 2, text: 'Global' },
    {
      kind: 'p',
      text: 'Active everywhere, regardless of focus.',
    },
    {
      kind: 'table',
      head: ['Key', 'Action'],
      rows: [
        ['`Tab`', 'Switch focus between the chat area and the prompt box'],
        [
          '`Esc`',
          'Close the Exa prompt, then the change-key box, then the slash menu; otherwise drop focus',
        ],
        ['`Ctrl+C`', 'Exit BabyPanda'],
      ],
    },
    {
      kind: 'p',
      text: '`Ctrl+C` is handled in the app rather than left to Ink’s `exitOnCtrlC`, because Ink compares the raw chunk against `\\x03` and misses two real cases: a terminal reporting the key through the Kitty keyboard protocol sends `ESC [ 99 ; 5 u` instead, and a chunk carrying `Ctrl+C` alongside any other byte fails the exact match. Both arrive here as ctrl + c, and a chunk containing the ETX byte anywhere is also caught.',
    },
    { kind: 'heading', level: 2, text: 'Prompt box' },
    {
      kind: 'p',
      text: 'Active while the prompt box has focus.',
    },
    { kind: 'heading', level: 3, text: 'Editing' },
    {
      kind: 'table',
      head: ['Key', 'Action'],
      rows: [
        ['`Enter`', 'Submit the prompt'],
        ['`Ctrl+J`', 'Insert a newline'],
        ['`Shift+Enter`', 'Insert a newline — only on terminals with the Kitty keyboard protocol'],
        ['`Alt+Enter`', 'Insert a newline — only if the terminal does not intercept it'],
        ['`←` / `→`', 'Move the cursor one character'],
        ['`↑` / `↓`', 'Move the cursor one visual line, keeping the display column'],
        ['`Backspace`', 'Delete the character before the cursor'],
        ['`Delete`', 'Delete the character after the cursor'],
        ['`Ctrl+W`', 'Delete the word before the cursor'],
        ['`Ctrl+U`', 'Delete from the cursor to the start of the line'],
        ['`Ctrl+K`', 'Delete from the cursor to the end of the line'],
        ['`Ctrl+Z`', 'Undo'],
        ['`Ctrl+Y`', 'Redo'],
        ['`Ctrl+L`', 'Clear the whole prompt box'],
        ['`Ctrl+O`', 'Paste an image from the clipboard as a chip'],
      ],
    },
    {
      kind: 'p',
      text: 'Undo and redo keep a depth of 100 snapshots. The cursor moves by grapheme, so a surrogate pair is never split, and it can never come to rest inside a collapsed chip: arriving from the left snaps to the chip’s start, from the right to its end.',
    },
    {
      kind: 'callout',
      variant: 'note',
      title: 'Newlines',
      text: '`Ctrl+J` is the newline key to rely on. Terminals without the Kitty keyboard protocol send `Shift+Enter` as a bare carriage return, which is indistinguishable from `Enter`, and many terminals swallow `Alt+Enter` as a window shortcut before it ever reaches the application.',
    },
    { kind: 'heading', level: 3, text: 'Scrolling' },
    {
      kind: 'table',
      head: ['Key', 'Action'],
      rows: [
        ['Mouse wheel', 'Scroll three rows per notch, only while the box has focus'],
        ['`PageUp` / `PageDown`', 'Scroll one viewport, minus one row of overlap'],
        ['`Home`', 'Jump to the very start of the content and scroll to the top'],
        ['`End`', 'Jump to the very end of the content and scroll to the bottom'],
      ],
    },
    {
      kind: 'p',
      text: 'The box wraps long lines instead of scrolling horizontally, so there is no horizontal scrolling to do. A one-column scrollbar appears on the right edge only when the content is taller than the box.',
    },
    { kind: 'heading', level: 2, text: 'Chat area' },
    {
      kind: 'p',
      text: 'Active while the chat area has focus.',
    },
    {
      kind: 'table',
      head: ['Key', 'Action'],
      rows: [
        ['`↑` / `↓`', 'Move focus between message groups'],
        ['`y`', 'Copy the focused message group to the clipboard'],
        ['`Space`', 'Expand or collapse the focused reasoning block or tool-call group'],
        ['Mouse wheel', 'Scroll the conversation'],
      ],
    },
    {
      kind: 'p',
      text: 'A “message group” is one assistant message, or a run of consecutive reasoning chunks treated as a single selectable block. `↑`/`↓` wrap at both ends. Copying a group joins its messages with newlines.',
    },
    {
      kind: 'p',
      text: 'The chat list is virtualised and stays anchored to the bottom while you are at the bottom; scrolling up never gets yanked back down.',
    },
    { kind: 'heading', level: 2, text: 'Menus' },
    {
      kind: 'p',
      text: 'The slash menu, the provider/model/effort/key menus and the permission menu are the same two-column component, so they share one set of bindings.',
    },
    {
      kind: 'table',
      head: ['Key', 'Action'],
      rows: [
        ['`↑` / `↓`', 'Move the selection'],
        ['`Enter`', 'Confirm the selection'],
        ['`Esc`', 'Close the slash menu, keeping the typed text'],
      ],
    },
    {
      kind: 'callout',
      variant: 'warning',
      title: 'TODO — `j`/`k` and `1`–`9` are not implemented',
      text: '`docs/shortcut.md` documents `j`/`k` and the number keys `1`–`9` as menu bindings. They are not: `SlashCommandMenu` handles only `upArrow`, `downArrow` and `return`, and nothing else in `packages/cli/src` reads those keys. Until they are added, use the arrow keys.',
    },
    { kind: 'heading', level: 2, text: 'Permission prompt' },
    {
      kind: 'p',
      text: 'Shown when the agent asks to run a tool. It is the one modal surface in the UI: the prompt box and the provider/model/effort/key menus are unmounted while it is up, so nothing else can act on the tree you are not looking at.',
    },
    {
      kind: 'table',
      head: ['Key', 'Action'],
      rows: [
        ['`↑` / `↓`', 'Move the selection'],
        ['`Enter`', 'Confirm the selection'],
        ['`Esc`', 'The same as **Don’t Allow** on the newest prompt'],
      ],
    },
    {
      kind: 'p',
      text: 'The three options are **Allow** (run this shell command once), **Don’t Allow** (block it) and **Always Allow** (run this and every later shell command).',
    },
    { kind: 'heading', level: 2, text: 'Mouse' },
    {
      kind: 'table',
      head: ['Target', 'Action'],
      rows: [
        ['Tool-call bullet or header row', 'Toggle the group, a diff, or a command'],
        ['Tool-call bullet', 'Hovering highlights it'],
        ['Prompt box, chat area', 'Wheel scroll, as described above'],
      ],
    },
    {
      kind: 'p',
      text: 'Wheel scrolling chains outwards: once the innermost region under the cursor is exhausted, the remainder passes to the next one out, so a diff viewer scrolled to its end hands the rest of the wheel to the chat. Each notch moves three rows.',
    },
    { kind: 'heading', level: 2, text: 'Status bar' },
    {
      kind: 'p',
      text: 'The single row under the prompt carries, in order: a spinner and activity label while a response is streaming, the session id, the session name, the provider, the model, the reasoning effort, the context length and the percentage used. When no Exa key is saved it ends with `web search off (/web-api-keys)`.',
    },
    {
      kind: 'p',
      text: 'The activity label is `Compacting` while a compaction runs, `Awaiting permission` while a permission prompt is pending, and `Responding` otherwise. Compaction wins over a pending permission, because it is the rarer and more specific state.',
    },
    { kind: 'heading', level: 2, text: 'Known quirks' },
    {
      kind: 'list',
      items: [
        'While a permission prompt is pending, the app-level key handler is still active, so `Tab`, `↑`/`↓`, `y` and `Space` still act on the chat tree behind the prompt as well as on the permission menu.',
        'The slash menu is not unmounted by a permission prompt, so one left open when a prompt appears stays on screen.',
        'A permission prompt takes the keyboard away from the prompt box, but the two share the terminal’s raw input stream; a key-repeat burst can therefore reach both.',
      ],
    },
  ],
};

export default page;
