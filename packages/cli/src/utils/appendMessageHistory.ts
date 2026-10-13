import {
	LogType,
	Message,
	type ServerStreamChunkSchemaType,
} from '@baby-panda/types';
import type {MessagesContext} from '../types';
import {writeLogs, getProjectName} from '@baby-panda/utils';
import type {ViewPortMessageContextValue} from '../context/ViewPortMessage';
import {breakMessageIntoLines, MessageLine} from '../utils/breakIntoLines';
import wcswidth from 'ts-wcwidth';

export function appendMessageHistory(
	chunk: ServerStreamChunkSchemaType,
	messageContext: MessagesContext,
) {
	const {setMessageHistory, lastRole} = messageContext;
	writeLogs(LogType.cli, getProjectName(), 'test', lastRole.current as string);
	if (lastRole.current == null || lastRole.current != chunk.role) {
		lastRole.current = chunk.role;
		setMessageHistory(prev => [
			...prev,
			{
				role: chunk.role,
				content: chunk.content,
				createdAt: Date.now(),
			},
		]);
	} else {
		setMessageHistory(prev => {
			const length = prev.length;
			return prev.map((msg, index) => {
				if (index !== length - 1) {
					return msg;
				}
				return {
					...msg,
					content: msg.content + chunk.content,
				};
			});
		});
	}
}

export function appendMessageLine(
	chunk: ServerStreamChunkSchemaType,
	viewPortMessageContext: ViewPortMessageContextValue,
	maxWidth: number,
) {
	const {viewPortMessages, setViewPortMessages} = viewPortMessageContext;

	const lastMessage = viewPortMessages.at(-1);
	const prev = viewPortMessages.splice(0, -1);

	const lastCreatedAt = lastMessage?.createdAt ?? Date.now();
	const createdAt = lastCreatedAt ? lastCreatedAt : Date.now();
	const {role, content} = chunk;
	const newLines = breakMessageIntoLines({role, content, createdAt}, maxWidth);

	let temp = lastMessage ? [lastMessage] : [];

	for (const line of newLines) {
		const common = temp.filter(Boolean).splice(0, -1);
		const cleanedCommon = common.filter(
			(item): item is MessageLine => item !== undefined,
		);
		const last = temp.at(-1);
		const merged = last ? mergeTwoLines(last, line, maxWidth) : [line];
		temp = [...cleanedCommon, ...merged];
	}

	const final = [...prev, ...temp];

	setViewPortMessages(final);

	// if (lastMessage == undefined || lastMessage.role !== chunk.role) {
	// 	setViewPortMessages(prev => [...prev, ...newLines]);
	// } else {
	// 	// first element of newLine;
	// 	const line = newLines.at(0);
	// 	//slice new line
	// 	if (line) {
	// 		if (line.lineLength + lastMessage.lineLength > maxWidth) {
	// 			// merge + newMessage;
	// 		} else {
	// 			// merge
	// 			const newLength = line.lineLength + lastMessage.lineLength;
	// 			const mergedLine: MessageLine = {
	// 				role: line.role,
	// 				content: lastMessage.content + line.content,
	// 				createdAt: lastCreatedAt,
	// 				lineLength: newLength,
	// 				isFirstLine: line.isFirstLine,
	// 				isIncomplete: newLength === maxWidth,
	// 			};

	// 			setViewPortMessages(prev => {
	// 				return prev.map((msg, index) => {
	// 					if (index === prev.length - 1) {
	// 						return mergedLine;
	// 					} else return msg;
	// 				});
	// 			});
	// 		}
	// 	}
	// }
}

function mergeTwoLines(
	line1: MessageLine,
	line2: MessageLine,
	maxWidth: number,
): MessageLine[] {
	const line2Content = line2.content;

	let i = 0;
	let nextChar = line2Content.at(i);
	let line1Content = line1.content;

	while (
		i < line2Content.length &&
		line1.lineLength + wcswidth(nextChar) < maxWidth
	) {
		line1Content += nextChar;
		i += 1;
		nextChar = line2Content.at(i);
	}
	if (i === line2Content.length) {
		return [{...line1, content: line1Content}];
	}
	return [
		{...line1, content: line1Content},
		{...line2, content: line2.content.slice(i)},
	];
}
