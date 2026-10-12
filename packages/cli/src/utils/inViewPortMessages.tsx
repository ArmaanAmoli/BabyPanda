import {getMessageHeight} from './getMessageHeight';
import type {CleanedMessage} from '@baby-panda/types';

export function inViewPortMessages(
	messageHistory: CleanedMessage[],
	frame: number,
	terminalRows: number,
) {
	const reversedMessageHistory = messageHistory.toReversed();
	const height = 0;
	const viewPortArray: CleanedMessage[] = [];
	for (const message of reversedMessageHistory) {
		const h = getMessageHeight(message);
		if (height + h < terminalRows) {
			viewPortArray.push(message);
		} else {
			// condense message
			const heightDifference = height + h - terminalRows;
			const noOfLinesToExtrace = h - heightDifference;
			const lines = message.content
				.split('\n')
				.slice(0, noOfLinesToExtrace)
				.join('\n');
			const reducedMessage: CleanedMessage = {
				role: message.role,
				content: lines,
				createdAt: Date.now(),
			};
			viewPortArray.push(reducedMessage);
			break;
		}
	}
	viewPortArray.reverse();
	return viewPortArray;
}
