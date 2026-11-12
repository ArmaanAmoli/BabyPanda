import wcwidth from 'ts-wcwidth';

/**
 * Columns permanently reserved on the right edge of the prompt box for the
 * scrollbar. Reserving the column unconditionally keeps the wrap width
 * constant, so the box height and the cursor's visual column never jitter as
 * content crosses the overflow threshold.
 */
export const SCROLLBAR_WIDTH = 1;

/**
 * One row of rendered prompt text. `text` is always a slice of the source
 * string — wrapping is a display concern and never rewrites the value.
 */
export interface VisualLine {
	text: string;
	/** UTF-16 offset of the line's first character in the source. */
	start: number;
	/** UTF-16 offset one past the line's last character in the source. */
	end: number;
	/** Terminal columns the line occupies. */
	displayWidth: number;
}

interface Character {
	text: string;
	offset: number;
	width: number;
}

function characterWidth(character: string): number {
	// Control characters report -1; a prompt box has no use for a zero-width
	// cell, so every character occupies at least one column.
	return Math.max(1, wcwidth(character));
}

function measureWidth(text: string): number {
	let width = 0;
	for (const character of text) {
		width += characterWidth(character);
	}

	return width;
}

function readCharacters(
	source: string,
	start: number,
	end: number,
): Character[] {
	const characters: Character[] = [];
	let offset = start;

	while (offset < end) {
		const codePoint = source.codePointAt(offset);
		if (codePoint === undefined) break;

		// Iterating by code point keeps surrogate pairs (and therefore emoji
		// and CJK) intact, while `offset` stays in UTF-16 units so it can be
		// compared against cursor positions directly.
		const text = String.fromCodePoint(codePoint);
		characters.push({text, offset, width: characterWidth(text)});
		offset += text.length;
	}

	return characters;
}

function isBreakingSpace(character: string): boolean {
	return character === ' ' || character === '\t';
}

function wrapHardLine(
	source: string,
	start: number,
	end: number,
	width: number,
	lines: VisualLine[],
): void {
	// An empty hard line still occupies a row: the cursor must be able to sit
	// on the blank line between two newlines.
	if (start >= end) {
		lines.push({text: '', start, end, displayWidth: 0});
		return;
	}

	const characters = readCharacters(source, start, end);
	let lineStart = start;
	let lineWidth = 0;
	// Offset one past the last breaking space seen on the current line.
	let breakAfter = -1;
	let index = 0;

	const pushLine = (lineEnd: number) => {
		const text = source.slice(lineStart, lineEnd);
		lines.push({
			text,
			start: lineStart,
			end: lineEnd,
			displayWidth: measureWidth(text),
		});
	};

	while (index < characters.length) {
		const character = characters[index]!;
		const characterEnd = character.offset + character.text.length;

		if (lineWidth + character.width > width && character.offset > lineStart) {
			// The line is full. Break after the last space that fit so words
			// stay intact; with no break opportunity, hard-break at this
			// character so an over-long token (a URL, minified JSON) is still
			// reachable. Either way the emitted line is at most `width` columns,
			// which matters because Ink re-wraps anything wider.
			const lineEnd = breakAfter > lineStart ? breakAfter : character.offset;

			pushLine(lineEnd);
			lineStart = lineEnd;
			lineWidth = 0;
			breakAfter = -1;

			// Rewind to the first character of the new line so the line's
			// width is re-accumulated from zero.
			while (index > 0 && characters[index - 1]!.offset >= lineStart) {
				index--;
			}

			continue;
		}

		lineWidth += character.width;
		if (isBreakingSpace(character.text)) {
			breakAfter = characterEnd;
		}

		index++;
	}

	pushLine(end);
}

/**
 * Splits `source` into visual lines of at most `width` columns.
 *
 * Newlines in the source always end a line. Within a line, breaks prefer the
 * last space that fits and fall back to a hard character break, so no content
 * is ever unreachable. The returned lines tile the source exactly: the `end`
 * of one line is the `start` of the next.
 */
export function wrapText(source: string, width: number): VisualLine[] {
	const lines: VisualLine[] = [];
	const safeWidth = Math.max(1, width);

	let lineStart = 0;
	let newlineIndex = source.indexOf('\n');

	while (newlineIndex !== -1) {
		wrapHardLine(source, lineStart, newlineIndex, safeWidth, lines);
		lineStart = newlineIndex + 1;
		newlineIndex = source.indexOf('\n', lineStart);
	}

	wrapHardLine(source, lineStart, source.length, safeWidth, lines);

	// A final line that exactly fills the width still needs a row for the
	// cursor, otherwise the cursor is clipped off the right edge.
	const lastLine = lines.at(-1);
	if (
		lastLine &&
		lastLine.text.length > 0 &&
		lastLine.displayWidth === safeWidth
	) {
		lines.push({
			text: '',
			start: lastLine.end,
			end: lastLine.end,
			displayWidth: 0,
		});
	}

	return lines;
}

/**
 * Number of terminal rows `value` occupies at `width`.
 *
 * Used both to size the prompt box and to size the permission panel, so the
 * two can never disagree about how tall a given string is.
 */
export function getWrappedLineCount(value: string, width: number): number {
	return wrapText(value, width).length;
}
