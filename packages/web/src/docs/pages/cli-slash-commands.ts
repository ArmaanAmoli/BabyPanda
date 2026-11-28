import type { DocPage } from '../types';

const page: DocPage = {
  slug: 'cli/slash-commands',
  group: 'CLI',
  category: 'CLI',
  title: 'Slash commands',
  subtitle: 'Everything you can type into the prompt box, and what each one does.',
  blocks: [
    {
      kind: 'p',
      text: 'Typing `/` in the prompt box opens the slash menu. It filters as you type, and it lists two kinds of entry: the built-in commands below, and every skill the model can see. A command name always wins a collision with a skill of the same name.',
    },
    {
      kind: 'p',
      text: 'Commands are submitted with `Enter`. While the menu is open it owns `Enter`, `↑` and `↓`; the prompt box keeps only the keystrokes that filter the list.',
    },
    { kind: 'heading', level: 2, text: 'The built-in commands' },
    {
      kind: 'table',
      head: ['Command', 'Effect'],
      rows: [
        ['`/provider`', 'Switch provider'],
        ['`/model`', 'Switch model'],
        ['`/efforts`', 'Set reasoning effort'],
        ['`/sandbox`', 'Toggle the shell sandbox'],
        ['`/api-key`', 'Change the saved Nvidia or Exa API key'],
        ['`/web-api-keys`', 'Add or change the Exa key for web search'],
        ['`/rename-session`', 'Rename this session'],
        ['`/<skill-name> <args>`', 'Activate a skill, with optional arguments'],
      ],
    },
    { kind: 'heading', level: 2, text: '/provider' },
    {
      kind: 'p',
      text: 'Opens a two-column menu of every provider the server knows about, from `GET /providers`. Each row shows the provider name and whether a key is already saved (`model provider` or `model provider · API key required`).',
    },
    {
      kind: 'p',
      text: 'Selecting one sets the session to that provider’s **first** model, resets the context counters, and sends the choice over the WebSocket — but only when the provider already has a key. The prompt is then cleared.',
    },
    { kind: 'heading', level: 2, text: '/model' },
    {
      kind: 'p',
      text: 'Lists the active provider’s models. Each row shows the model name, its context length (`1,000,000 context`) and `· in use` beside the current one.',
    },
    {
      kind: 'p',
      text: 'Selecting a model sets the provider and model, resets `contextWindowUsed` to `0`, replaces the effort list with that model’s own accepted efforts, and picks the first of them. It then pre-fills the prompt with `/efforts` so choosing an effort is the very next thing you do.',
    },
    { kind: 'heading', level: 2, text: '/efforts' },
    {
      kind: 'p',
      text: 'Lists the efforts the current model accepts, with `in use` beside the active one. Selecting one updates the local state and sends the setting over the WebSocket.',
    },
    {
      kind: 'p',
      text: 'Typed by hand, `/efforts` takes exactly one argument from the `ReasoningEffort` enum. Anything else throws.',
    },
    {
      kind: 'callout',
      variant: 'warning',
      title: 'TODO — the error message is stale',
      text: '`executeCommand` validates against the whole `ReasoningEffort` enum (`none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`) but its error text still reads “effort must be one of: none, low, medium, high”. The message under-reports what is actually accepted.',
    },
    { kind: 'heading', level: 2, text: '/sandbox' },
    {
      kind: 'p',
      text: 'Takes one argument, `enable` or `disable`. `enable` turns the bubblewrap sandbox on for shell calls; `disable` turns it off.',
    },
    {
      kind: 'list',
      items: [
        '`/sandbox` with **no** argument is a no-op — it changes nothing and reports nothing.',
        'Any other argument throws. (The error text has a typo: it says `diable`.)',
        'The sandbox is Linux-only; anywhere else it throws rather than silently running unsandboxed.',
      ],
    },
    { kind: 'heading', level: 2, text: '/api-key' },
    {
      kind: 'p',
      text: 'Opens a menu of every model provider plus `exa`, each row showing whether a key is saved. Picking one opens a change box; `Escape` cancels it and the saved key is left untouched.',
    },
    {
      kind: 'p',
      text: 'Submitting saves the key. If it is the key for the provider currently in use, the new key is also pushed over the WebSocket so it takes effect without a restart; other providers pick it up from the database when `/provider` selects them.',
    },
    { kind: 'heading', level: 2, text: '/web-api-keys' },
    {
      kind: 'p',
      text: 'Opens the Exa key box directly, skipping the menu. Saving the key enables `web_search` and `get_web_page`; the status bar’s `web search off` notice disappears.',
    },
    {
      kind: 'p',
      text: 'The same box appears on its own at startup when no Exa key is saved. It is optional, so `Escape` skips it and the notice stays.',
    },
    { kind: 'heading', level: 2, text: '/rename-session' },
    {
      kind: 'code',
      lang: 'text',
      code: '/rename-session refactor auth',
    },
    {
      kind: 'p',
      text: 'Everything after the command word is the name, so a name may contain spaces. An empty name prints `Usage: /rename-session <name>`. On success the toast reads `Session renamed to <name>`; on failure it reads `Rename failed: <reason>`.',
    },
    {
      kind: 'p',
      text: 'The name must be 1–64 characters with no control characters, and unique inside the directory. Renaming frees the old number, so the next new session in that directory reuses it.',
    },
    { kind: 'heading', level: 2, text: 'Skills' },
    {
      kind: 'p',
      text: 'A skill is invoked as `/<skill-name>` followed by its arguments. Only the declared positional arguments belong to the skill; the leftover text is treated as your message and waits for the skill to load.',
    },
    {
      kind: 'list',
      items: [
        'Commands win collisions: if a command and a skill share a name, the command runs.',
        'Images may ride on a skill invocation — they become part of the user message that follows the skill, never part of its arguments.',
        "Commands take text only. Submitting one with an image chip is blocked with `Commands can't carry images — remove them first`.",
        'An unknown name is a local error only: nothing is sent, and the toast reads `Unknown command or skill: …`.',
      ],
    },
    {
      kind: 'p',
      text: 'Skills are discovered from `~/.babypanda/skills/<name>/SKILL.md` (global) and `<cwd>/.babypanda/skills/<name>/SKILL.md` (project), with the project tier winning a name collision. A skill marked `disable-model-invocation` is hidden from the model entirely and can only be activated by you.',
    },
    { kind: 'heading', level: 2, text: 'What a command does not do' },
    {
      kind: 'list',
      items: [
        '`/provider`, `/model` and `/efforts` only change the **current** session. The choice is persisted on the session row, so reopening that session restores it — but a new session starts from the defaults.',
        '`/sandbox` is not persisted. It lives on the agent instance, so closing the session resets it.',
        'Nothing here touches the database schema or the migrations.',
      ],
    },
  ],
};

export default page;
