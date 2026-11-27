# BabyPanda system commands

BabyPanda ships a set of commands that run outside the terminal UI. They talk to
the same local SQLite database the UI does, so what they print and change is
exactly what the UI sees.

| Command                            | What it does                                          |
| ---------------------------------- | ----------------------------------------------------- |
| `babypanda`                        | Start a new session in the current directory          |
| `babypanda <session-id>`           | Open an existing session                              |
| `babypanda open <session-id>`      | Open an existing session (explicit form of the above) |
| `babypanda list`                   | List the sessions in the current directory            |
| `babypanda delete <session-id>...` | Delete sessions in the current directory              |
| `babypanda install`                | Register `babypanda` on this computer                 |
| `babypanda uninstall`              | Remove that registration                              |
| `babypanda help`                   | Show the usage summary                                |

Every command exits `0` on success and `1` on failure, so they compose in
scripts.

## Registering the command

`babypanda` is not on PATH just because the repository is cloned. Register it
once with:

```bash
babypanda install
```

That resolves what is actually running — a compiled binary, or the checkout when
started with `bun packages/cli/src/cli.tsx` — and puts a `babypanda` entry on
PATH:

- a **compiled binary** is symlinked, so it keeps updating when you rebuild;
- a **checkout** gets a small wrapper script that execs `bun` on the
  entrypoint, because there is no binary to link. The wrapper points at this
  checkout, so keep the checkout where it is.

The install directory is chosen in this order:

1. `--dir <path>`, if given;
2. `$BABY_PANDA_BIN_DIR`, if set;
3. the first writable directory that is already on PATH — `/usr/local/bin`,
   then `/usr/bin`, then `~/.local/bin`, then `~/.bin`.

Preferring a directory that is already on PATH means the command works in every
shell straight away. When none of them is writable, or the chosen one is not on
PATH, the command prints the `export PATH=...` line to add, or adds it for you
with `--add-to-path` (it appends to `~/.bashrc`, `~/.zshrc`,
`~/.config/fish/config.fish`, or `~/.profile` depending on `$SHELL`).

```bash
# install somewhere specific, and put it on PATH for me
babypanda install --dir ~/.local/bin --add-to-path

# replace an existing registration
babypanda install --force

# copy the binary instead of symlinking it (for filesystems without symlinks)
babypanda install --copy

# take it back off PATH
babypanda uninstall
```

`uninstall` only removes a registration it recognises — a symlink pointing at
the running executable, or a wrapper carrying its own marker. Anything else is
left alone unless you pass `--force`, so an unrelated `babypanda` on the machine
is never deleted by surprise.

### Alternatives

For development, `bun link` registers the workspace package without building a
binary:

```bash
bun install
bun run --filter @baby-panda/cli build
bun link --cwd packages/cli        # or: bun link @baby-panda/cli
```

A standalone binary can also be linked by hand:

```bash
bun run --filter @baby-panda/cli build-binary
ln -s "$PWD/packages/cli/bin/babypanda" ~/.local/bin/babypanda
```

## Listing sessions

```bash
babypanda list
```

```text
Sessions in /home/me/project (3)

  #  SESSION ID                  NAME           MESSAGES  CREATED           AGE
  1  01M77HWGB50QE8H3MTHFGPC4XY  refactor auth         2  2026-11-17 10:00  2h ago
  2  01M76GD4617ZTSHNMWRWZ322Z0  untitled-2          277  2026-11-16 06:00  1d ago
  3  01M72PYB2NDHZC635C0W3FC3YK  untitled-1          258  2026-11-10 12:29  2026-11-10 12:29

Open one with `babypanda open <session-id>`, remove one with `babypanda delete <session-id>`.
```

Newest first. `--json` emits the same data as
`{projectDirectory, sessions: [...]}` for scripting.

Sessions are scoped to the directory they were created in, so `babypanda list`
only ever shows the ones belonging to `process.cwd()`.

## Session names

Every session carries a name. A new one starts as `untitled-<n>`, numbered per
directory, and `/rename-session <name>` inside the terminal UI changes it:

```bash
/rename-session refactor auth
```

The name is shown at the right edge of the terminal's status bar and in the
`NAME` column above. Names are unique inside a directory — two projects may
both have an `untitled-1` — and a name is 1-64 characters with no control
characters. Renaming a session frees its old number, so the next new session in
that directory reuses it rather than climbing without bound.

## Opening a session

```bash
babypanda open 01M77HWGB50QE8H3MTHFGPC4XY
babypanda 01M77HWGB50QE8H3MTHFGPC4XY     # the same thing
```

A session id may be shortened to any unique prefix, because a 26-character ULID
is not something to type out:

```bash
babypanda open 01M77HW
```

An ambiguous prefix is reported with its candidates rather than guessed at, and
an unknown one is an error — the old behaviour of silently starting a session
with a bogus id is gone.

## Deleting sessions

```bash
babypanda delete 01M77HWGB50QE8H3MTHFGPC4XY 01M76GD
```

Every reference is resolved before anything is removed, so one typo cannot
delete the sessions that were named correctly; the command reports every problem
it found and deletes nothing. Messages are deleted with their session — the
`message.session_id` foreign key cascades.

Deletion is confirmed interactively:

```text
About to delete 2 sessions and 279 messages:
  01M77HWGB50QE8H3MTHFGPC4XY
  01M76GD4617ZTSHNMWRWZ322Z0
Delete these sessions? [y/N]
```

`--yes` (`-y`) skips the prompt. Without it, a non-interactive stdin is refused
rather than assumed, so a script cannot wipe a directory's history by accident.

## Environment variables

| Variable             | Used by   | Description                                                       |
| -------------------- | --------- | ----------------------------------------------------------------- |
| `BABY_PANDA_BIN_DIR` | `install` | Default install directory when `--dir` is not given               |
| `IN_DEV_MODE`        | all       | `true` uses `~/.babypanda/db/db.test.db` instead of `db.db`       |
| `BABY_PANDA_PORT`    | the UI    | Fixed port for the in-process server (not used by these commands) |

Note that `bun` loads a `.env` from the current directory, so a project with
`IN_DEV_MODE=true` in its `.env` makes the commands read the test database. The
compiled binary is built with `autoloadDotenv: false` and only reads the real
environment.
