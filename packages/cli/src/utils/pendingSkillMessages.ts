import type {MultiModalContent} from '@baby-panda/types';

/**
 * A user message typed after a skill's declared arguments cannot be sent
 * together with the skill event: the model must never see the message before
 * the skill it belongs to. The CLI therefore parks the message here until the
 * server confirms the skill loaded (the `skill` event with ok: true) and only
 * then sends it. Entries are keyed by skill name so a confirmation drains the
 * message parked for that invocation.
 *
 * Content is the exact WebSocket payload: a plain string, or text/image parts
 * when the invocation carried pasted images (images never join the skill's
 * arguments — they belong to this user message).
 */
interface PendingSkillMessage {
	name: string;
	content: string | MultiModalContent;
}

const pending: PendingSkillMessage[] = [];

export function enqueuePendingSkillMessage(
	name: string,
	content: string | MultiModalContent,
): void {
	pending.push({name, content});
}

/**
 * Removes and returns the message parked for `name`, or undefined when none
 * is waiting. Called for both outcomes: a failed load discards the message
 * instead of leaving it parked for a later invocation of the same skill.
 */
export function takePendingSkillMessage(
	name: string,
): string | MultiModalContent | undefined {
	const index = pending.findIndex(entry => entry.name === name);
	if (index === -1) return undefined;
	const [entry] = pending.splice(index, 1);
	return entry?.content;
}
