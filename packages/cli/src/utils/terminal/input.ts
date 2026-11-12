export const ESC = '\x1b';
export const SGR_EVENT_PREFIX = `${ESC}[<`;
export const X11_EVENT_PREFIX = `${ESC}[M`;

// Bracketed paste markers. Terminals only emit them while paste mode is on,
// which is what lets a paste be told apart from typing.
export const PASTE_START = `${ESC}[200~`;
export const PASTE_END = `${ESC}[201~`;

// eslint-disable-next-line no-control-regex
export const SGR_MOUSE_REGEX = /^\x1b\[<(\d+);(\d+);(\d+)([mM])/; // SGR mouse events
// eslint-disable-next-line no-control-regex
export const X11_MOUSE_REGEX = /^\x1b\[M([\s\S]{3})/;

export function couldBeSGRMouseSequence(buffer: string): boolean {
	if (buffer.length === 0) return true;
	// Check if buffer is a prefix of a mouse sequence starter
	if (SGR_EVENT_PREFIX.startsWith(buffer)) return true;
	// Check if buffer is a mouse sequence prefix
	if (buffer.startsWith(SGR_EVENT_PREFIX)) return true;

	return false;
}

export function couldBeMouseSequence(buffer: string): boolean {
	if (buffer.length === 0) return true;

	// Check SGR prefix
	if (
		SGR_EVENT_PREFIX.startsWith(buffer) ||
		buffer.startsWith(SGR_EVENT_PREFIX)
	)
		return true;
	// Check X11 prefix
	if (
		X11_EVENT_PREFIX.startsWith(buffer) ||
		buffer.startsWith(X11_EVENT_PREFIX)
	)
		return true;

	return false;
}

/**
 * True when `buffer` is a proper prefix of the paste start marker, i.e. the
 * rest of the marker may still arrive in a later chunk. Callers use this to
 * wait instead of flushing the bytes as literal text.
 */
export function isPasteStartPrefix(buffer: string): boolean {
	return PASTE_START.startsWith(buffer);
}
