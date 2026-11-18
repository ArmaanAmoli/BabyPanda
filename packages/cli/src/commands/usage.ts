/** Name the commands are registered under on the user's machine. */
export const COMMAND_NAME = 'babypanda';

export const USAGE = `BabyPanda - terminal coding agent

Usage:
  ${COMMAND_NAME}                        start a new session in this directory
  ${COMMAND_NAME} <session-id>           open an existing session
  ${COMMAND_NAME} open <session-id>      open an existing session (explicit form)
  ${COMMAND_NAME} list                   list the sessions in this directory
  ${COMMAND_NAME} delete <session-id>... delete sessions in this directory
  ${COMMAND_NAME} install                register ${COMMAND_NAME} on this computer
  ${COMMAND_NAME} uninstall              remove that registration
  ${COMMAND_NAME} help                   show this help

A session id may be shortened to any unique prefix of it.

Options:
  list       --json               emit the session list as JSON
  delete     --yes, -y            delete without asking for confirmation
  install    --dir <path>         install into <path> instead of the default
  install    --copy               copy the executable instead of symlinking it
  install    --force, -f          replace an existing installation
  install    --add-to-path        append the install directory to your shell rc
  uninstall  --dir <path>         remove the registration from <path>
  uninstall  --force, -f          remove a registration that is not ours

Environment:
  BABY_PANDA_BIN_DIR   default install directory for ${COMMAND_NAME} install
`;

export function printUsage(
	stream: NodeJS.WritableStream = process.stdout,
): void {
	stream.write(`${USAGE}\n`);
}
