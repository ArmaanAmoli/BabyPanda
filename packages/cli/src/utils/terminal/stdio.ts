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
	writeToStdOut('\x1b[?1002h\x1b[?1006h');
}

export function disableMouseEvents() {
	writeToStdOut(
		'\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1006l\x1b[?25h\x1b[?7h',
	);
}

export function activateAlternateScreenBuffer() {
	writeToStdOut('\x1b[?1049h');
}

export function deactivateAlternateScreenBuffer() {
	writeToStdOut('\x1b[?1049l');
}

export function enableKittyKeyboardProtocol() {
	writeToStdOut('\x1b[>1u');
}

export function disableKittyKeyboardProtocol() {
	writeToStdOut('\x1b[<u');
}

export function enableLineWrapping() {
	writeToStdOut('\x1b[?7h');
}

export function disableLineWrapping() {
	writeToStdOut('\x1b[?7l');
}
