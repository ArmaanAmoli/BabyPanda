import type {ServerStreamChunkSchemaType} from '@baby-panda/types';
import type {MessagesContext} from '../types';

// type WsUserMessage = WsEventMessage & {eventType: typeof WsEventTypes.message};

export function appendMessageHistory(
	chunk: ServerStreamChunkSchemaType,
	messageContext: MessagesContext,
) {
	const {messageHistory, setMessageHistory} = messageContext;
	const lastRole = messageHistory.at(messageHistory.length - 1)?.role ?? null;
	if (lastRole == null || lastRole != chunk.role) {
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
