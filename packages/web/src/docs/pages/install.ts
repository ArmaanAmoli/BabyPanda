import type { DocPage } from '../types';

const page: DocPage = {
  slug: 'install',
  group: 'Get started',
  category: 'Get started',
  title: 'Install',
  subtitle: 'One command on Linux x86_64 and WSL; from source everywhere else.',
  blocks: [
    { kind: 'heading', level: 2, text: 'Requirements' },
    {
      kind: 'list',
      items: [
        'A terminal that supports the interactive Ink UI.',
        'An API key for a supported model provider — see [Providers and models](#/providers).',
        'Linux or macOS is recommended for development; Windows support has not been verified.',
      ],
    },
    { kind: 'heading', level: 2, text: 'Install with the curl script' },
    {
      kind: 'p',
      text: 'The release publishes a standalone Linux x86_64 binary. The install script downloads it, verifies its checksum, installs it to `~/.local/bin`, and adds that directory to your PATH.',
    },
    {
      kind: 'code',
      lang: 'bash',
      title: 'Install the latest release',
      code: 'curl -fsSL --connect-timeout 5 --retry 3 \\\n  https://raw.githubusercontent.com/ArmaanAmoli/BabyPanda/main/install.sh | bash',
    },
    {
      kind: 'p',
      text: 'The script refuses to run anywhere else: it checks `uname -s` and `uname -m` and exits with a message on anything that is not Linux on x86_64.',
    },
    {
      kind: 'callout',
      variant: 'warning',
      title: 'TODO — macOS and other platforms',
      text: 'No pre-built binary is published for macOS, Windows or Linux on ARM. The install script only knows the `babypanda-linux-x64` asset. Until a release publishes those assets, install from a checkout as described below.',
    },
    { kind: 'heading', level: 2, text: 'Verify the install' },
    {
      kind: 'code',
      lang: 'bash',
      code: 'babypanda help',
    },
    {
      kind: 'p',
      text: 'You may need to restart your terminal, or `source` your shell configuration, before `babypanda` is found. The script prints the exact line it appended to `~/.bashrc`, `~/.zshrc` or `~/.profile`.',
    },
    {
      kind: 'table',
      head: ['Check', 'Expected'],
      rows: [
        ['`babypanda help`', 'Prints the usage summary and exits 0'],
        ['`command -v babypanda`', 'A path under `~/.local/bin` (or your chosen directory)'],
        ['`babypanda list`', 'Lists the sessions in the current directory, or an empty list'],
      ],
    },
    { kind: 'heading', level: 2, text: 'Pin a version' },
    {
      kind: 'code',
      lang: 'bash',
      code: 'BABY_PANDA_VERSION=v0.1.0 bash install.sh',
    },
    {
      kind: 'p',
      text: 'Without `BABY_PANDA_VERSION` the script follows the `latest` release. Running it again upgrades an existing installation in place.',
    },
    { kind: 'heading', level: 2, text: 'Install from a checkout' },
    {
      kind: 'p',
      text: 'Any platform Bun runs on can build BabyPanda from source. This is also the path for contributing.',
    },
    {
      kind: 'code',
      lang: 'bash',
      title: 'From source',
      code: 'git clone https://github.com/ArmaanAmoli/BabyPanda.git\ncd BabyPanda\nbun install\n\n# Build the standalone binary, then register it\nbun run --filter @baby-panda/cli build-binary\nbabypanda install --dir ~/.local/bin --add-to-path',
    },
    {
      kind: 'p',
      text: 'For day-to-day development, `bun link` registers the workspace package without building a binary:',
    },
    {
      kind: 'code',
      lang: 'bash',
      code: 'bun install\nbun run --filter @baby-panda/cli build\nbun link --cwd packages/cli',
    },
    { kind: 'heading', level: 2, text: 'Registering the command' },
    {
      kind: 'p',
      text: 'A cloned repository is not on PATH by itself. `babypanda install` resolves what is actually running — a compiled binary, or the checkout when started with `bun packages/cli/src/cli.tsx` — and puts a `babypanda` entry on PATH. A compiled binary is symlinked so it keeps updating when you rebuild; a checkout gets a small wrapper script that execs `bun` on the entrypoint.',
    },
    {
      kind: 'p',
      text: 'The install directory is chosen in this order: `--dir <path>`, then `$BABY_PANDA_BIN_DIR`, then the first writable directory already on PATH (`/usr/local/bin`, `/usr/bin`, `~/.local/bin`, `~/.bin`).',
    },
    {
      kind: 'code',
      lang: 'bash',
      code: 'babypanda install --dir ~/.local/bin --add-to-path\nbabypanda install --force        # replace an existing registration\nbabypanda install --copy         # copy instead of symlinking\nbabypanda uninstall             # take it back off PATH',
    },
    {
      kind: 'callout',
      variant: 'note',
      title: 'Uninstall is conservative',
      text: '`babypanda uninstall` only removes a registration it recognises — a symlink pointing at the running executable, or a wrapper carrying its own marker. Anything else is left alone unless you pass `--force`, so an unrelated `babypanda` on the machine is never deleted by surprise.',
    },
  ],
};

export default page;
