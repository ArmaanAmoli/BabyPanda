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

export interface ImageSegment {
	kind: 'image';
	/** Stable across edits and undo, so React keys and lookups stay valid. */
	id: string;
	/** Generated display name, e.g. 'image-1.png'. Nothing is written to disk. */
	name: string;
	width: number;
	height: number;
	/** The payload sent to the model: data:image/png;base64,... */
	dataUrl: string;
	/**
	 * Inline placeholder kept in promptText, so the cursor and every offset
	 * computation treat an image like a short piece of text.
	 */
	text: string;
	/** Images are always collapsed chips; unlike a paste they never expand. */
	collapsed: true;
}

export type PromptSegment = TextSegment | PasteSegment | ImageSegment;

export interface PromptValue {
	segments: PromptSegment[];
}

let nextPasteId = 0;
let nextImageId = 0;

function createPasteId(): string {
	nextPasteId += 1;
	return `paste-${nextPasteId}`;
}

/**
 * Seeds the image counter from the chat history, so an image pasted after a
 * session reload never reuses a name already in the transcript. Placeholder
 * names (`image-N.png`) are matched wherever they appear; with no images in
 * history the counter starts at 0, so the first paste is image-1.png.
 */
export function initializeImageIdFromHistory(contents: string[]): void {
	let highest = 0;
	for (const content of contents) {
		for (const match of content.matchAll(/image-(\d+)\.png/g)) {
			highest = Math.max(highest, Number(match[1]));
		}
	}
	nextImageId = highest;
}

/**
 * Creates the segment for a clipboard image. The data URL is the only place
 * the bytes live (they end up in the message content, hence in the DB); the
 * generated name gives the chip and the text placeholder something to show.
 */
export function createImageSegment(image: {
	width: number;
	height: number;
	dataUrl: string;
}): ImageSegment {
	nextImageId += 1;
	const name = `image-${nextImageId}.png`;
	return {
		kind: 'image',
		id: `image-${nextImageId}`,
		name,
		width: image.width,
		height: image.height,
		dataUrl: image.dataUrl,
		text: `[image: ${name}]`,
		collapsed: true,
	};
}

/** A collapsed chip (paste or image) is atomic: one row, cursor stays outside. */
export function isChipSegment(
	segment: PromptSegment,
): segment is PasteSegment | ImageSegment {
	return segment.kind !== 'text' && segment.collapsed;
}

export function isImageSegment(
	segment: PromptSegment,
): segment is ImageSegment {
	return segment.kind === 'image';
}

export function getImageSegments(value: PromptValue): ImageSegment[] {
	return value.segments.filter(isImageSegment);
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
	return segment.kind === 'text' ? {kind: 'text', text} : {...segment, text};
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
 *
 * Collapsed chips are atomic for every edit, not just Backspace/Delete: a
 * deletion that touches any part of a chip removes the whole chip, and an
 * insertion strictly inside one is clamped to its start. Without this, a
 * partial erase (Ctrl+W over a chip's placeholder, say) leaves a sliced chip
 * behind — a corrupted image segment that still renders and still gets sent.
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

		if (isChipSegment(segment)) {
			const deletionOverlaps =
				start !== end && start < segmentEnd && end > position;

			if (deletionOverlaps) {
				// The whole chip goes. The replacement, if any, still belongs at
				// the edit's start, exactly as in the generic path below.
				if (!placed && start <= segmentEnd) {
					placed = true;
					if (replacement) {
						next.push(replacement);
					}
				}

				position = segmentEnd;
				continue;
			}

			const insertionInside =
				start === end && start > position && start < segmentEnd;
			if (insertionInside) {
				// Clamp to the chip's start rather than splitting it in two.
				if (!placed) {
					placed = true;
					if (replacement) {
						next.push(replacement);
					}
				}

				next.push(segment);
				position = segmentEnd;
				continue;
			}
		}

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
 * Range of the collapsed chip (paste or image) ending exactly at `offset`.
 *
 * A collapsed chip is atomic: the cursor can only sit immediately before or
 * after one, never inside, so one Backspace removes the whole block and its
 * contents can never be partially edited. An expanded paste is ordinary text
 * and edits character by character like anything else.
 */
export function getChipRangeBefore(
	value: PromptValue,
	offset: number,
): {start: number; end: number} | null {
	let position = 0;

	for (const segment of value.segments) {
		const segmentEnd = position + segment.text.length;

		if (isChipSegment(segment) && segmentEnd === offset) {
			return {start: position, end: segmentEnd};
		}

		position = segmentEnd;
	}

	return null;
}

/** Range of the collapsed chip starting exactly at `offset`, if any. */
export function getChipRangeAfter(
	value: PromptValue,
	offset: number,
): {start: number; end: number} | null {
	let position = 0;

	for (const segment of value.segments) {
		if (isChipSegment(segment) && position === offset) {
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
