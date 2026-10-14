// import {getMessageHeight} from './getMessageHeight';
// import type {CleanedMessage} from '@baby-panda/types';

export const SCROLL_ROWS = 2; // one scroll moves 3 rows

// function trimMessageHeight(
// 	message: CleanedMessage,
// 	reducedBy: number,
// 	trimFromUp: boolean,
// ): CleanedMessage {
// 	const lines = message.content.split('\n');
// 	if (trimFromUp) {
// 		lines.splice(0, reducedBy);
// 	} else {
// 		lines.splice(lines.length - reducedBy, reducedBy);
// 	}

// 	const content = lines.join('\n');
// 	return {role: message.role, content, createdAt: message.createdAt};
// }

// export function inViewPortMessages(
// 	messageHistory: CleanedMessage[],
// 	terminalRows: number,
// 	offset?: number,
// ) {
// 	/*
// 		we need to add the offset shift feature
// 		offset start from 0 and goes to infinite
// 		scroll 0 refers to most recent messages (the start / default window)
// 	*/
// 	const scrollFrame = offset ? offset : 0;

// 	const reversedMessageHistory = messageHistory.toReversed();
// 	let height = 0;
// 	let skipBuffer = scrollFrame * SCROLL_ROWS; // if this not zero skip the line;
// 	const result: CleanedMessage[] = [];

// 	for (const message of reversedMessageHistory) {
// 		const h = getMessageHeight(message);
// 		// selection part

// 		if (skipBuffer > 0) {
// 			// scroll-up
// 			if (skipBuffer >= h) {
// 				skipBuffer -= h;
// 				continue;
// 			} else {
// 				// reduce message by h
// 				const trimedMessage = trimMessageHeight(message, skipBuffer, false);
// 				height += skipBuffer;
// 				skipBuffer = 0;
// 				result.push(trimedMessage);
// 			}
// 		} else {
// 			// window finishing
// 			// creating part
// 			if (height + h < terminalRows) {
// 				result.push(message);
// 				height += h;
// 			} else {
// 				// condense message
// 				const heightDifference = height + h - terminalRows;
// 				const reducedMessage = trimMessageHeight(
// 					message,
// 					heightDifference,
// 					true,
// 				);
// 				result.push(reducedMessage);
// 				break;
// 			}
// 		}
// 	}
// 	result.reverse();
// 	return result;
// }
