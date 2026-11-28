import type { DocPage } from '../types';

const page: DocPage = {
  slug: 'sessions',
  group: 'Concepts',
  category: 'Concepts',
  title: 'Sessions',
  subtitle: 'One conversation, one directory, one row in SQLite.',
  blocks: [
    {
      kind: 'p',
      text: 'A session is the unit of conversation in BabyPanda. It owns a message history, a model choice and a reasoning-effort choice, and it is bound to the directory it was created in. Everything else — the server, the agent, the tools — is shared machinery that a session drives.',
    },
    { kind: 'heading', level: 2, text: 'What a session stores' },
    {
      kind: 'table',
      head: ['Field', 'Meaning'],
      rows: [
        ['`session_id`', 'Primary key: a 26-character ULID'],
        ['`created_at`', 'Creation timestamp, in milliseconds'],
        ['`parent_session_id`', 'Reserved for session lineage; not populated today'],
        ['`messages_count`', 'Number of persisted messages'],
        ['`tokens_in_context_window`', 'Tokens counted against the model’s context window'],
        ['`project_directory`', 'The directory the session belongs to'],
        ['`name`', 'Human-facing label, unique inside a directory'],
        ['`provider` / `model`', 'The model settings last used'],
        ['`reasoning_effort`', 'The reasoning effort last used'],
      ],
    },
    {
      kind: 'p',
      text: 'The model settings are stored on the session row, so reopening a session restores the model and reasoning effort you last used instead of the defaults.',
    },
    { kind: 'heading', level: 2, text: 'Independent, concurrent sessions' },
    {
      kind: 'p',
      text: 'Sessions are independent. Start the same command in two terminals and you get two sessions, each with its own agent, its own history and its own WebSocket connection. Nothing is shared between them except the database file.',
    },
    {
      kind: 'code',
      lang: 'bash',
      code: '# Terminal 1\nbun run --filter @baby-panda/cli dev\n\n# Terminal 2\nbun run --filter @baby-panda/cli dev',
    },
    {
      kind: 'p',
      text: 'The in-process server picks the first free port from 3500 upward, so concurrent sessions never fight over a port. Set `BABY_PANDA_PORT` only when a specific fixed port is required.',
    },
    {
      kind: 'callout',
      variant: 'note',
      title: 'Scoped to a directory',
      text: '`babypanda list` only ever shows the sessions belonging to `process.cwd()`. Two projects may both have an `untitled-1` without colliding, because the name is unique per directory rather than globally.',
    },
    { kind: 'heading', level: 2, text: 'Persistence' },
    {
      kind: 'p',
      text: 'Every message is written to SQLite as it is produced, so a session survives a crash, a reboot and a different terminal. The history is reloaded from the database when a session is opened, and the agent rebuilds its context from it.',
    },
    {
      kind: 'p',
      text: 'Messages carry a `role` and a monotonically increasing `sequence`. The roles are `user`, `assistant`, `tool`, `system`, plus two internal ones: `compaction` for a stored summary and `skill` for a user-injected skill body. Compaction summaries are never sent to the terminal — the server filters them out of `/get-messages` — and skill rows are shown to the user but presented to the provider as ordinary `user` messages.',
    },
    { kind: 'heading', level: 2, text: 'Session names' },
    {
      kind: 'p',
      text: 'A new session starts as `untitled-<n>`, numbered per directory. `/rename-session <name>` changes it; the name is 1–64 characters with no control characters and must be unique inside the directory. Renaming frees the old number, so the next new session in that directory reuses it rather than climbing without bound.',
    },
    {
      kind: 'code',
      lang: 'bash',
      code: '/rename-session refactor auth',
    },
    {
      kind: 'p',
      text: 'The name appears next to the session id in the status bar and in the `NAME` column of `babypanda list`.',
    },
    { kind: 'heading', level: 2, text: 'Deleting a session' },
    {
      kind: 'p',
      text: '`babypanda delete <session-id>...` removes the session and its messages. The `message.session_id` foreign key cascades, so no orphaned rows are left behind.',
    },
  ],
};

export default page;
