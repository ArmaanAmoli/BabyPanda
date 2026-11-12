import wcwidth from 'ts-wcwidth';

const OSC8_TERM_PROGRAMS = new Set([
	'iTerm.app',
	'WezTerm',
	'ghostty',
	'kitty',
	'vscode',
	'WarpTerminal',
	'rio',
	'foot',
]);

/** Terminals known to render OSC 8 hyperlinks; others get plain text. */
export function supportsOsc8Hyperlinks(): boolean {
	const termProgram = process.env['TERM_PROGRAM'];
	return termProgram != null && OSC8_TERM_PROGRAMS.has(termProgram);
}

/** Wraps text in an OSC 8 hyperlink pointing at url. */
export function osc8Link(url: string, text: string): string {
	return `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`;
}

function displayWidth(text: string): number {
	let width = 0;
	for (const char of text) {
		width += Math.max(0, wcwidth(char));
	}
	return width;
}

/**
 * Splits text into a head that fits maxWidth display columns (ending with
 * '…' when cut) and the remaining rest, so a truncated row can reveal the
 * part that was cut off.
 */
export function splitTruncated(
	text: string,
	maxWidth: number,
): {head: string; rest: string} {
	if (maxWidth <= 1) return {head: '…', rest: text};
	if (displayWidth(text) <= maxWidth) return {head: text, rest: ''};
	const chars = [...text];
	let head = '';
	let width = 0;
	let index = 0;
	for (; index < chars.length; index++) {
		const charWidth = Math.max(1, wcwidth(chars[index]!));
		if (width + charWidth + 1 > maxWidth) break; // +1 reserves room for '…'
		head += chars[index];
		width += charWidth;
	}
	return {head: head + '…', rest: chars.slice(index).join('')};
}

/** Truncates the end of text with '…' so its display width fits maxWidth. */
export function truncateEnd(text: string, maxWidth: number): string {
	return splitTruncated(text, maxWidth).head;
}

/** Hard-wraps text to maxWidth display columns (wide chars are never split). */
export function wrapText(text: string, maxWidth: number): string[] {
	if (maxWidth <= 0) return [''];
	const lines: string[] = [];
	let line = '';
	let width = 0;
	for (const char of text) {
		const charWidth = Math.max(1, wcwidth(char));
		if (width + charWidth > maxWidth && line.length > 0) {
			lines.push(line);
			line = char;
			width = charWidth;
		} else {
			line += char;
			width += charWidth;
		}
	}
	if (line.length > 0 || lines.length === 0) lines.push(line);
	return lines;
}

/**
 * Display text for a URL: the https:// prefix is stripped and, when the
 * result is too wide, the END is truncated with '…'. The domain is never cut:
 * if the domain alone exceeds maxWidth, the whole domain is kept and the path
 * is hard-truncated after it.
 */
export function linkDisplayText(url: string, maxWidth: number): string {
	const stripped = url.replace(/^https:\/\//, '');
	if (maxWidth <= 1) return '…';
	if (displayWidth(stripped) <= maxWidth) return stripped;

	// Keep the full domain (everything up to the first '/').
	const domainEnd = stripped.indexOf('/');
	const domain = domainEnd === -1 ? stripped : stripped.slice(0, domainEnd);

	if (displayWidth(domain) >= maxWidth) {
		// Domain alone is too wide: keep it intact, hard-truncate after it.
		let result = '';
		let width = 0;
		for (const char of domain) {
			const charWidth = Math.max(1, wcwidth(char));
			if (width + charWidth > maxWidth) break;
			result += char;
			width += charWidth;
		}
		return result + '…';
	}

	// Truncate the path end, keeping the domain and the start of the path.
	let result = domain;
	let width = displayWidth(domain);
	const rest = domainEnd === -1 ? '' : stripped.slice(domainEnd);
	for (const char of rest) {
		const charWidth = Math.max(1, wcwidth(char));
		if (width + charWidth + 1 > maxWidth) break; // +1 reserves room for '…'
		result += char;
		width += charWidth;
	}
	return result + '…';
}
