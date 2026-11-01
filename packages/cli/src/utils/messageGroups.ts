import {Role} from '@baby-panda/types';
import type {CleanedMessage} from '@baby-panda/types';

/**
 * Returns consecutive thought messages as one selectable group.
 * Every other message remains its own group.
 */
export function getMessageGroups(messages: readonly CleanedMessage[]) {
	const groups: number[][] = [];

	for (const [index, message] of messages.entries()) {
		const previous = groups.at(-1);
		const previousMessage =
			previous == null ? undefined : messages[previous[0]];

		if (
			message.role === Role.thought &&
			previousMessage?.role === Role.thought
		) {
			previous?.push(index);
		} else {
			groups.push([index]);
		}
	}

	return groups;
}

export function getGroupForMessage(
	groups: readonly number[][],
	messageIndex: number,
) {
	return groups.findIndex(group => group.includes(messageIndex));
}
