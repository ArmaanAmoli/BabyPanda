import {spawn} from 'node:child_process';

const clipboardCommands: Partial<
	Record<NodeJS.Platform, Array<{command: string; args: string[]}>>
> = {
	darwin: [{command: 'pbcopy', args: []}],
	linux: [
		{command: 'wl-copy', args: []},
		{command: 'xclip', args: ['-selection', 'clipboard']},
		{command: 'xsel', args: ['--clipboard', '--input']},
	],
	win32: [{command: 'clip', args: []}],
	android: [{command: 'termux-clipboard-set', args: []}],
	cygwin: [{command: 'clip', args: []}],
};

function copyWithCommand(
	command: string,
	args: string[],
	content: string,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {stdio: ['pipe', 'ignore', 'ignore']});
		child.once('error', reject);
		child.once('close', code => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`${command} exited with code ${code ?? 'unknown'}`));
			}
		});
		child.stdin.end(content);
	});
}

export async function copyToClipboard(content: string): Promise<void> {
	const commands = clipboardCommands[process.platform] ?? [];
	let lastError: unknown;

	for (const {command, args} of commands) {
		try {
			await copyWithCommand(command, args, content);
			return;
		} catch (error) {
			lastError = error;
		}
	}

	throw new Error(
		`No usable clipboard command was found${lastError ? `: ${String(lastError)}` : ''}`,
	);
}
