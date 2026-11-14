import {ContentType, Role} from '@baby-panda/types';

/**
 * Transcript grouping for the chat renderer.
 *
 * A single LLM response arrives as interleaved reasoning / tool-call / content
 * chunks, so arrival order is not display order. The agent loop runs in
 * iterations — one LLM call each — and every iteration renders its own three
 * boxes in fixed order: reasoning, content, tool call. A tool-call batch ends
 * its iteration (the assistant message that asked for tools is complete), and
 * the run's last iteration closes at the next user message. Empty boxes are
 * dropped at render time.
 *
 * Grouping is derived at render time from the flat message list alone: no
 * message data changes, and history reloaded from the DB groups identically.
 */

/** One renderable box of the transcript, in display order. */
export type TranscriptBox =
	/** A user message, rendered with its full-width band. */
	| {kind: 'user'; index: number}
	/** A skill notice or other unslotted role, rendered in place. */
	| {kind: 'prefix'; index: number}
	/** Every reasoning chunk of one iteration, merged into one block. */
	| {kind: 'reasoning'; indices: number[]}
	/** Every prose chunk of one iteration (live `content` or reloaded
	 * `assistant` rows), merged into one block. */
	| {kind: 'content'; indices: number[]}
	/** One tool-call batch: the last box of its iteration. */
	| {kind: 'tool'; index: number};

function isContentRole(role: Role | ContentType): boolean {
	// live stream chunks carry `content`; the DB stores the same prose as
	// `assistant` — both render in the content box
	return role === ContentType.content || role === Role.assistant;
}

/**
 * Splits the transcript into render boxes. User messages stand alone; a
 * tool-call batch closes the iteration accumulated before it; whatever
 * reasoning/content remains when the next user message (or the transcript
 * end) arrives is the run's final, tool-less iteration.
 */
export function buildTranscriptBoxes(
	roles: readonly {role: Role | ContentType}[],
): TranscriptBox[] {
	const boxes: TranscriptBox[] = [];
	let reasoning: number[] = [];
	let content: number[] = [];

	const flushIteration = () => {
		if (reasoning.length > 0)
			boxes.push({kind: 'reasoning', indices: reasoning});
		if (content.length > 0) boxes.push({kind: 'content', indices: content});
		reasoning = [];
		content = [];
	};

	for (const [index, message] of roles.entries()) {
		if (message.role === Role.user) {
			flushIteration();
			boxes.push({kind: 'user', index});
			continue;
		}
		if (message.role === ContentType.reasoning_content) {
			reasoning.push(index);
			continue;
		}
		if (message.role === ContentType.tool_call) {
			flushIteration();
			boxes.push({kind: 'tool', index});
			continue;
		}
		if (isContentRole(message.role)) {
			content.push(index);
			continue;
		}
		// skill notices and other unslotted roles render in place; a notice
		// arriving mid-iteration splits it, which keeps chronology intact
		flushIteration();
		boxes.push({kind: 'prefix', index});
	}
	flushIteration();

	return boxes;
}
