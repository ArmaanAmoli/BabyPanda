import {LogType, type ServerStreamChunkSchemaType} from '@baby-panda/types';
import type {MessagesContext} from '../types';
import {writeLogs, getProjectName} from '@baby-panda/utils';

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

// export function appendMessageLine(
// 	chunk: ServerStreamChunkSchemaType,
// 	viewPortMessageContext: ViewPortMessageContextValue,
// 	maxWidth: number,
// ) {
// 	const {viewPortMessages, setViewPortMessages} = viewPortMessageContext;

// 	const lastMessage = viewPortMessages.at(-1);
// 	const prev = viewPortMessages.slice(0, -1);

// 	const lastCreatedAt = lastMessage?.createdAt ?? Date.now();
// 	const createdAt = lastCreatedAt ? lastCreatedAt : Date.now();
// 	const {role, content} = chunk;
// 	const newLines = breakMessageIntoLines({role, content, createdAt}, maxWidth);

// 	let temp = lastMessage ? [lastMessage] : [];

// 	for (const line of newLines) {
// 		const common = temp.filter(Boolean).slice(0, -1);
// 		const cleanedCommon = common.filter(
// 			(item): item is MessageLine => item !== undefined,
// 		);
// 		const last = temp.at(-1);
// 		const merged = last ? mergeTwoLines(last, line, maxWidth) : [line];
// 		temp = [...cleanedCommon, ...merged];
// 	}

// 	const final = [...prev, ...temp];

// 	setViewPortMessages(final);
// }

// function mergeTwoLines(
// 	line1: MessageLine,
// 	line2: MessageLine,
// 	maxWidth: number,
// ): MessageLine[] {
// 	const line2Content = line2.content;

// 	let i = 0;
// 	let nextChar = line2Content.at(i);
// 	let line1Content = line1.content;

// 	while (
// 		i < line2Content.length &&
// 		line1.lineLength + wcswidth(nextChar) < maxWidth
// 	) {
// 		line1Content += nextChar;
// 		i += 1;
// 		nextChar = line2Content.at(i);
// 	}
// 	if (i === line2Content.length) {
// 		return [{...line1, content: line1Content}];
// 	}
// 	return [
// 		{...line1, content: line1Content},
// 		{...line2, content: line2.content.slice(i)},
// 	];
// }
