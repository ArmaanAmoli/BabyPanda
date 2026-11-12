/**
 * The prompt box's value model.
 *
 * A prompt is an ordered list of segments rather than a flat string, because a
 * large paste collapses into a chip and the box has to remember where each chip
 * is and whether it is expanded. A flat string plus offset ranges was rejected:
 * every keystroke would have to repair the ranges of every later paste, which
 * is exactly where off-by-one bugs live. With segments an edit stays local to
 * one segment, and undo becomes a one-line snapshot.
 *
 * Everything here is a pure function of its arguments. The prompt box owns the
 * cursor, the scroll offset and the undo stack; this module owns the data.
 */

export interface TextSegment {
	kind: 'text';
	text: string;
}

export interface PasteSegment {
	kind: 'paste';
	/** Stable across edits and undo, so React keys and lookups stay valid. */
	id: string;
	text: string;
	/** A collapsed segment renders as a one-row chip instead of its text. */
	collapsed: boolean;
}

export type PromptSegment = TextSegment | PasteSegment;

export interface PromptValue {
	segments: PromptSegment[];
}

let nextPasteId = 0;

function createPasteId(): string {
	nextPasteId += 1;
	return `paste-${nextPasteId}`;
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.max(minimum, Math.min(maximum, value));
}

/** A prompt value holding nothing but `text`. */
export function textValue(text: string): PromptValue {
	return {segments: [{kind: 'text', text}]};
}

/** The plain string the agent and the chat history see. */
export function promptText(value: PromptValue): string {
	return value.segments.map(segment => segment.text).join('');
}

export function isEmptyPrompt(value: PromptValue): boolean {
	return promptText(value).length === 0;
}

function cloneWithText(segment: PromptSegment, text: string): PromptSegment {
	return segment.kind === 'paste' ? {...segment, text} : {kind: 'text', text};
}

/**
 * Drops empty text segments and merges adjacent ones, so an edit that deletes a
 * chip cannot leave the value fragmented. The flattened text is unchanged, so
 * offsets computed before normalizing stay valid.
 */
export function normalizePromptValue(value: PromptValue): PromptValue {
	const segments: PromptSegment[] = [];

	for (const segment of value.segments) {
		if (segment.text.length === 0) continue;

		const previous = segments.at(-1);
		if (previous && previous.kind === 'text' && segment.kind === 'text') {
			segments[segments.length - 1] = {
				kind: 'text',
				text: previous.text + segment.text,
			};
			continue;
		}

		segments.push(segment);
	}

	if (segments.length === 0) {
		segments.push({kind: 'text', text: ''});
	}

	return {segments};
}

/**
 * Replaces the flattened range `[start, end)` with `replacement`.
 *
 * This one primitive covers insertion (`start === end`), deletion
 * (`replacement` null) and replacement. Offsets are UTF-16 code-unit positions
 * into `promptText(value)`, matching the cursor the prompt box keeps.
 */
export function replaceRange(
	value: PromptValue,
	start: number,
	end: number,
	replacement: PromptSegment | null,
): PromptValue {
	const next: PromptSegment[] = [];
	let position = 0;
	let placed = false;

	for (const segment of value.segments) {
		const segmentEnd = position + segment.text.length;
		const localStart = clamp(start - position, 0, segment.text.length);
		const localEnd = clamp(end - position, 0, segment.text.length);

		const before = segment.text.slice(0, localStart);
		const after = segment.text.slice(localEnd);

		if (before.length > 0) {
			next.push(cloneWithText(segment, before));
		}

		// The replacement belongs at the first segment that contains `start`.
		// Checking `start <= segmentEnd` rather than `start < segmentEnd` keeps
		// an insertion at a segment boundary on the correct side.
		if (!placed && start <= segmentEnd) {
			placed = true;
			if (replacement) {
				next.push(replacement);
			}
		}

		if (after.length > 0) {
			next.push(cloneWithText(segment, after));
		}

		position = segmentEnd;
	}

	// `start` was past the end of every segment: append.
	if (!placed && replacement) {
		next.push(replacement);
	}

	return normalizePromptValue({segments: next});
}

/**
 * Range of the paste segment ending exactly at `offset`, if any.
 *
 * Paste segments are atomic: the cursor can only sit immediately before or
 * after one, never inside. This lets Backspace remove a whole chip in one press
 * without ever being able to partially edit its contents.
 */
export function getPasteRangeBefore(
	value: PromptValue,
	offset: number,
): {start: number; end: number} | null {
	let position = 0;

	for (const segment of value.segments) {
		const segmentEnd = position + segment.text.length;

		if (segment.kind === 'paste' && segmentEnd === offset) {
			return {start: position, end: segmentEnd};
		}

		position = segmentEnd;
	}

	return null;
}

/** Range of the paste segment starting exactly at `offset`, if any. */
export function getPasteRangeAfter(
	value: PromptValue,
	offset: number,
): {start: number; end: number} | null {
	let position = 0;

	for (const segment of value.segments) {
		if (segment.kind === 'paste' && position === offset) {
			return {start: position, end: position + segment.text.length};
		}

		position += segment.text.length;
	}

	return null;
}

export function expandPasteSegment(
	value: PromptValue,
	id: string,
): PromptValue {
	return {
		segments: value.segments.map(segment =>
			segment.kind === 'paste' && segment.id === id
				? {...segment, collapsed: false}
				: segment,
		),
	};
}

export function createPasteSegment(text: string): PasteSegment {
	return {kind: 'paste', id: createPasteId(), text, collapsed: true};
}

export interface PasteResult {
	value: PromptValue;
	/** Id of the chip this paste created, or null when it expanded one instead. */
	pasteId: string | null;
	expanded: boolean;
}

/**
 * Applies a paste at `offset`.
 *
 * Pasting identical content again, with no other input in between, expands the
 * most recent collapsed chip back into the real text it came from — that is the
 * only way a chip's contents can be recovered. Any other paste creates a new
 * chip. `previousPasteId` is the id returned by the immediately preceding paste,
 * or null once anything else has been edited.
 */
export function applyPaste(
	value: PromptValue,
	offset: number,
	text: string,
	previousPasteId: string | null,
): PasteResult {
	const previous =
		previousPasteId === null
			? undefined
			: value.segments.find(
					segment => segment.kind === 'paste' && segment.id === previousPasteId,
				);

	if (
		previous &&
		previous.kind === 'paste' &&
		previous.collapsed &&
		previous.text === text
	) {
		return {
			value: expandPasteSegment(value, previous.id),
			pasteId: null,
			expanded: true,
		};
	}

	const segment = createPasteSegment(text);
	return {
		value: replaceRange(value, offset, offset, segment),
		pasteId: segment.id,
		expanded: false,
	};
}
