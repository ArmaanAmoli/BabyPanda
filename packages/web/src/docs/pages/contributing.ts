import type { DocPage } from '../types';

const page: DocPage = {
  slug: 'contributing',
  group: 'Project',
  category: 'Project',
  title: 'Contributing',
  subtitle: 'Set up the workspace with Bun and run the checks from the repository root.',
  blocks: [
    {
      kind: 'p',
      text: 'BabyPanda is a Bun workspace monorepo, so every dependency and every script goes through Bun. There is no npm lockfile — do not create one.',
    },
    { kind: 'heading', level: 2, text: 'Development setup' },
    {
      kind: 'code',
      lang: 'bash',
      title: 'From a fresh clone',
      code: 'git clone https://github.com/ArmaanAmoli/BabyPanda.git\ncd BabyPanda\n\n# 1. Install every workspace dependency (updates the root bun.lock)\nbun install\n\n# 2. Create the local environment file\ncp .env.example .env\n\n# 3. Edit .env and set IN_DEV_MODE=true while developing\n$EDITOR .env\n\n# 4. Apply the local SQLite migrations\nbun run --filter @baby-panda/db migrate-production\n\n# 5. Start the terminal application\nbun run --filter @baby-panda/cli dev',
    },
    {
      kind: 'p',
      text: 'The CLI starts the local Hono server in-process and opens the terminal interface. The server listens on `http://localhost:3000` by convention, but the CLI picks the first free port from 3500 upward unless `BABY_PANDA_PORT` is set.',
    },
    {
      kind: 'callout',
      variant: 'note',
      title: 'Use the test database',
      text: 'Set `IN_DEV_MODE=true` in your `.env` while developing. It points the application at `~/.babypanda/db/db.test.db` instead of the real database, so a stray run cannot contaminate your own sessions.',
    },
    { kind: 'heading', level: 2, text: 'Commands' },
    {
      kind: 'p',
      text: 'Run these from the repository root:',
    },
    {
      kind: 'code',
      lang: 'bash',
      code: '# Type-check every workspace package\nbun run type-check\n\n# Lint the complete repository\nbun run lint\n\n# Format supported files\nbun run format\n\n# Type-check one package\nbun run --filter @baby-panda/agent type-check\n\n# Landing page and docs (packages/web)\nbun run --filter web dev\nbun run --filter web build\nbun run --filter web preview',
    },
    {
      kind: 'table',
      head: ['Package', 'Dev command'],
      rows: [
        ['`@baby-panda/cli`', '`bun run --filter @baby-panda/cli dev`'],
        ['`@baby-panda/server`', '`bun run --filter @baby-panda/server dev`'],
        ['`web`', '`bun run --filter web dev`'],
      ],
    },
    {
      kind: 'p',
      text: 'The web package additionally has `bun run --filter web lint` (oxlint) and `bun run --filter web type-check`.',
    },
    { kind: 'heading', level: 2, text: 'Working on the docs' },
    {
      kind: 'p',
      text: 'The documentation site lives in `packages/web` and is built by the same Vite build as the landing page. Content is typed data under `packages/web/src/docs/pages`; the sidebar, the tab row and the previous/next links all read from `packages/web/src/docs/navigation.ts`.',
    },
    {
      kind: 'list',
      ordered: true,
      items: [
        'Add a file under `src/docs/pages` exporting a `DocPage`.',
        'Add its slug to the right group in `src/docs/navigation.ts`.',
        'Run `bun run --filter web build` and open `packages/web/dist/docs/`.',
      ],
    },
    {
      kind: 'p',
      text: 'Do not introduce a new palette or a new typeface. The tokens in `src/index.css` and `src/theme.ts` are the whole design system.',
    },
    { kind: 'heading', level: 2, text: 'Pull requests' },
    {
      kind: 'list',
      items: [
        'Keep a change to one concern; split a refactor from a behaviour change.',
        'Run `bun run type-check` and `bun run lint` before opening a pull request.',
        'Write a commit message that says what changed and why, in the imperative.',
        'Never include a provider API key, a log file, or a `.env` in a commit.',
      ],
    },
    {
      kind: 'callout',
      variant: 'warning',
      title: 'Reporting a bug',
      text: 'Include the command you ran, your operating system, your Bun version, whether `IN_DEV_MODE` was enabled, and a redacted error log. Never include provider API keys.',
    },
  ],
};

export default page;
