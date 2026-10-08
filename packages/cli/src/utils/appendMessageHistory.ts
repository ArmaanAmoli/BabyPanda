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
