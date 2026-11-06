import {ContentType} from '@baby-panda/types';
import type {ChatMessage} from '../types';

/**
 * Returns consecutive reasoning_content messages as one selectable group.
 * Every other message remains its own group.
 */
export function getMessageGroups(messages: readonly ChatMessage[]) {
	const groups: number[][] = [];

	for (const [index, message] of messages.entries()) {
		const previous = groups.at(-1);
		const previousMessage =
			previous == null ? undefined : messages[previous[0]];

		if (
			message.role === ContentType.reasoning_content &&
			previousMessage?.role === ContentType.reasoning_content
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
