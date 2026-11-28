import type { DocPage } from '../types';

const page: DocPage = {
  slug: 'logging-and-configuration',
  group: 'Architecture',
  category: 'Architecture',
  title: 'Logging and configuration',
  subtitle: 'The four environment variables, and the one log file per session.',
  blocks: [
    {
      kind: 'p',
      text: 'BabyPanda is configured entirely through the environment. There is no config file, no CLI flag parser for settings, and no remote configuration — copy `.env.example` to `.env` if you need to change anything.',
    },
    { kind: 'heading', level: 2, text: 'Configuration' },
    {
      kind: 'table',
      head: ['Variable', 'Required', 'Default', 'Description'],
      rows: [
        [
          '`IN_DEV_MODE`',
          'No',
          '`false`',
          'When `true`, uses `~/.babypanda/db/db.test.db`; otherwise `~/.babypanda/db/db.db`',
        ],
        [
          '`BABY_PANDA_PORT`',
          'No',
          'Automatic',
          'Optional fixed local HTTP and WebSocket port. Without it, BabyPanda selects the first available port from `3500` upward',
        ],
        [
          '`BABY_PANDA_BIN_DIR`',
          'No',
          '—',
          'Default install directory for `babypanda install` when `--dir` is not given',
        ],
        [
          '`BABY_PANDA_LOG_TTL_DAYS`',
          'No',
          '`7`',
          'How long a log file is kept before startup cleanup removes it',
        ],
      ],
    },
    {
      kind: 'p',
      text: 'The environment file does not configure provider selection, model selection or the database path. Provider and model choices are stored in the database and changed from the UI.',
    },
    {
      kind: 'callout',
      variant: 'note',
      title: 'The port is validated',
      text: '`BABY_PANDA_PORT` must be an integer between 1 and 65535; anything else throws at import time rather than failing later. When it is set, an address-in-use error is fatal — the automatic scan only happens when the port was not configured.',
    },
    { kind: 'heading', level: 2, text: 'Where the files live' },
    {
      kind: 'code',
      lang: 'text',
      code: '~/.babypanda/\n├── db/\n│   ├── db.db           # IN_DEV_MODE=false (the default)\n│   └── db.test.db      # IN_DEV_MODE=true\n├── logs/\n│   └── <project>/<sessionId>.log\n└── projects/\n    └── <project>/\n        ├── MEMORY.md\n        └── <note>.md',
    },
    {
      kind: 'p',
      text: 'Development mode uses a separate database file to reduce the chance of contaminating local development data.',
    },
    { kind: 'heading', level: 2, text: 'Logs' },
    {
      kind: 'p',
      text: 'Errors are appended to one file per session, `~/.babypanda/logs/<project>/<sessionId>.log`. Every entry is a single grep-friendly physical line:',
    },
    {
      kind: 'code',
      lang: 'text',
      code: '[agent] 2026-11-28T04:12:09.412Z ERROR: compaction failed | cause: Error: compaction failed: <- Error: connect ETIMEDOUT',
    },
    {
      kind: 'p',
      text: 'The tag is the subsystem — `agent`, `server`, `mcp` — and a cause chain is flattened onto the same line with `<-` between levels. Newlines inside a description are collapsed, so one entry is always one line.',
    },
    {
      kind: 'p',
      text: 'On every startup the logs tree is cleaned: files older than the retention window are deleted. Age is measured by last-modified time, so a session that is still being written to is never removed. The cleanup is fire-and-forget, so it never delays boot.',
    },
    {
      kind: 'callout',
      variant: 'warning',
      title: 'Logs are not redacted',
      text: 'A log line can contain a command, a file path or an error message. Never paste one into an issue without reading it first, and never include a provider API key.',
    },
    { kind: 'heading', level: 2, text: 'Database and migrations' },
    {
      kind: 'code',
      lang: 'bash',
      code: '# Generate a migration after changing the Drizzle schema\nbun run --filter @baby-panda/db generate\n\n# Apply migrations to the normal local database\nbun run --filter @baby-panda/db migrate-production\n\n# Apply migrations to the isolated test database\nbun run --filter @baby-panda/db migrate-dev',
    },
    {
      kind: 'p',
      text: 'The CLI runs the migrations and syncs the write-ahead log on startup, so a fresh clone needs no separate setup step.',
    },
  ],
};

export default page;
