import type { DocPage } from '../types';

const page: DocPage = {
  slug: 'cli/commands',
  group: 'CLI',
  category: 'CLI',
  title: 'Commands',
  subtitle: 'Everything the `babypanda` command does outside the terminal UI.',
  blocks: [
    {
      kind: 'p',
      text: 'BabyPanda installs one command with two faces. With no arguments it starts the interactive terminal UI; with a subcommand it is a plain script that reads and writes the same local SQLite database the UI uses. Every command exits `0` on success and `1` on failure, so they compose in scripts.',
    },
    {
      kind: 'callout',
      variant: 'warning',
      title: 'TODO — flag forms not yet implemented',
      text: 'The command surface is positional: `babypanda <session-id>` and `babypanda open <session-id>` resume a session, and `babypanda list` lists them. There is no `-s`/`--session` flag and no `babypanda list session` subcommand in `packages/cli/src/commands`. This page documents what the code does today.',
    },
    { kind: 'heading', level: 2, text: 'The command surface' },
    {
      kind: 'table',
      head: ['Command', 'What it does'],
      rows: [
        ['`babypanda`', 'Start a new session in the current directory'],
        ['`babypanda <session-id>`', 'Open an existing session'],
        ['`babypanda open <session-id>`', 'Open an existing session (explicit form)'],
        ['`babypanda list`', 'List the sessions in the current directory'],
        ['`babypanda delete <session-id>...`', 'Delete sessions in the current directory'],
        ['`babypanda install`', 'Register `babypanda` on this computer'],
        ['`babypanda uninstall`', 'Remove that registration'],
        ['`babypanda help`', 'Show the usage summary'],
      ],
    },
    {
      kind: 'p',
      text: '`list` also answers to `ls`, `delete` to `rm`, and `open` to `resume`. Anything that is not a known subcommand is treated as a session id, which is what makes the bare `babypanda 01M77HW` form work.',
    },
    { kind: 'heading', level: 2, text: 'Starting and resuming sessions' },
    {
      kind: 'code',
      lang: 'bash',
      code: 'babypanda                          # new session in this directory\nbabypanda 01M77HWGB50QE8H3MTHFGPC4XY # open one\nbabypanda open 01M77HWGB50QE8H3MTHFGPC4XY\nbabypanda open 01M77HW               # a unique prefix is enough',
    },
    {
      kind: 'p',
      text: 'A session id is a 26-character ULID, so it is never meant to be typed in full. Any unique prefix resolves. An ambiguous prefix is reported with its candidates rather than guessed at, and an unknown one is an error — the old behaviour of silently starting a session with a bogus id is gone.',
    },
    { kind: 'heading', level: 2, text: 'Listing sessions' },
    {
      kind: 'code',
      lang: 'bash',
      code: 'babypanda list',
    },
    {
      kind: 'code',
      lang: 'text',
      title: 'Output',
      code: 'Sessions in /home/me/project (3)\n\n  #  SESSION ID                  NAME           MESSAGES  CREATED           AGE\n  1  01M77HWGB50QE8H3MTHFGPC4XY  refactor auth         2  2026-11-17 10:00  2h ago\n  2  01M76GD4617ZTSHNMWRWZ322Z0  untitled-2          277  2026-11-16 06:00  1d ago\n  3  01M72PYB2NDHZC635C0W3FC3YK  untitled-1          258  2026-11-10 12:29  2026-11-10 12:29',
    },
    {
      kind: 'p',
      text: 'Newest first. Sessions are scoped to the directory they were created in, so `babypanda list` only ever shows the ones belonging to `process.cwd()`. `--json` emits the same data as `{projectDirectory, sessions: [...]}` for scripting.',
    },
    { kind: 'heading', level: 2, text: 'Deleting sessions' },
    {
      kind: 'code',
      lang: 'bash',
      code: 'babypanda delete 01M77HWGB50QE8H3MTHFGPC4XY 01M76GD',
    },
    {
      kind: 'p',
      text: 'Every reference is resolved before anything is removed, so one typo cannot delete the sessions that were named correctly: the command reports every problem it found and deletes nothing. Messages are deleted with their session — the `message.session_id` foreign key cascades.',
    },
    {
      kind: 'p',
      text: 'Deletion is confirmed interactively. `--yes` (`-y`) skips the prompt; without it, a non-interactive stdin is refused rather than assumed, so a script cannot wipe a directory’s history by accident.',
    },
    {
      kind: 'code',
      lang: 'text',
      title: 'Confirmation prompt',
      code: 'About to delete 2 sessions and 279 messages:\n  01M77HWGB50QE8H3MTHFGPC4XY\n  01M76GD4617ZTSHNMWRWZ322Z0\nDelete these sessions? [y/N]',
    },
    { kind: 'heading', level: 2, text: 'Options' },
    {
      kind: 'table',
      head: ['Command', 'Option', 'Meaning'],
      rows: [
        ['`list`', '`--json`', 'Emit the session list as JSON'],
        ['`delete`', '`--yes`, `-y`', 'Delete without asking for confirmation'],
        ['`install`', '`--dir <path>`', 'Install into `<path>` instead of the default'],
        ['`install`', '`--copy`', 'Copy the executable instead of symlinking it'],
        ['`install`', '`--force`, `-f`', 'Replace an existing installation'],
        ['`install`', '`--add-to-path`', 'Append the install directory to your shell rc'],
        ['`uninstall`', '`--dir <path>`', 'Remove the registration from `<path>`'],
        ['`uninstall`', '`--force`, `-f`', 'Remove a registration that is not ours'],
      ],
    },
    { kind: 'heading', level: 2, text: 'Environment variables' },
    {
      kind: 'table',
      head: ['Variable', 'Used by', 'Description'],
      rows: [
        [
          '`BABY_PANDA_BIN_DIR`',
          '`install`',
          'Default install directory when `--dir` is not given',
        ],
        ['`IN_DEV_MODE`', 'all', '`true` uses `~/.babypanda/db/db.test.db` instead of `db.db`'],
        [
          '`BABY_PANDA_PORT`',
          'the UI',
          'Fixed port for the in-process server (not used by these commands)',
        ],
      ],
    },
    {
      kind: 'callout',
      variant: 'note',
      title: 'Bun loads `.env` too',
      text: '`bun` loads a `.env` from the current directory, so a project with `IN_DEV_MODE=true` in its `.env` makes these commands read the test database. The compiled binary is built with `autoloadDotenv: false` and only reads the real environment.',
    },
  ],
};

export default page;
