const defaultStdOut = process.stdout.write.bind(process.stdout);
const defaultStdErr = process.stderr.write.bind(process.stderr);

export function writeToStdOut(
	...args: Parameters<typeof process.stdout.write>
) {
	defaultStdOut(...args);
}

export function writeToStdErr(
	...args: Parameters<typeof process.stderr.write>
) {
	defaultStdErr(...args);
}

export function enableMouseEvents() {
	writeToStdOut('\u001b[?1002h\u001b[?1006h');
}

export function disableMouseEvents() {
	writeToStdOut('\u001b[?1006l\u001b[1002l');
}

export function activateAlternateScreenBuffer() {
	writeToStdOut('\u001b[\x1b[?1049h');
}

export function deactivateAlternateScreenBuffer() {
	writeToStdOut('\u001b[\x1b[?1049l');
}
