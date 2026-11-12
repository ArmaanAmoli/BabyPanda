import {ContentType} from '@baby-panda/types';
import type {WsToolCallRequest, WsToolResultEvent} from '@baby-panda/types';
import type {MessagesContext, ToolCallBatch, ToolCallEntry} from '../types';
import {decodeToolCallBatch, encodeToolCallBatch} from '../types';

let batchCounter = 0;

function nextBatchId(): string {
	batchCounter += 1;
	return `toolcall-${Date.now()}-${batchCounter}`;
}

/** Appends one tool-call batch as a new `tool_call` history entry. */
export function appendToolCallBatch(
	messageContext: MessagesContext,
	requests: WsToolCallRequest[],
): void {
	if (requests.length === 0) return;
	const batch: ToolCallBatch = {
		id: nextBatchId(),
		createdAt: Date.now(),
		calls: requests.map(request => ({
			id: request.id,
			name: request.name,
			arguments: request.arguments,
			status: 'running',
		})),
	};
	messageContext.lastRole.current = ContentType.tool_call;
	messageContext.setMessageHistory(previous => [
		...previous,
		{
			role: ContentType.tool_call,
			content: encodeToolCallBatch(batch),
			createdAt: batch.createdAt,
		},
	]);
}

/** Applies a tool_result event to the batch entry that contains the call id. */
export function applyToolResult(
	messageContext: MessagesContext,
	event: WsToolResultEvent,
): void {
	messageContext.setMessageHistory(previous => {
		// update the last tool_call entry that contains this call id
		for (let index = previous.length - 1; index >= 0; index--) {
			const message = previous[index]!;
			if (message.role !== ContentType.tool_call) continue;
			const batch = decodeToolCallBatch(message.content);
			if (batch == null || !batch.calls.some(call => call.id === event.id)) {
				continue;
			}
			const calls: ToolCallEntry[] = batch.calls.map(call =>
				call.id === event.id
					? {
							...call,
							status: event.success ? 'done' : 'failed',
							error: event.error,
							before: event.before,
							stats: event.stats,
							pages: event.pages,
						}
					: call,
			);
			const next = [...previous];
			next[index] = {
				...message,
				content: encodeToolCallBatch({...batch, calls}),
			};
			return next;
		}
		return previous;
	});
}

/**
 * When the response ends, any call still marked running never got a result
 * event (crash / abort): mark it failed so history reflects what happened.
 */
export function failRunningToolCalls(messageContext: MessagesContext): void {
	messageContext.setMessageHistory(previous => {
		let changed = false;
		const next = previous.map(message => {
			if (message.role !== ContentType.tool_call) return message;
			const batch = decodeToolCallBatch(message.content);
			if (batch == null) return message;
			if (!batch.calls.some(call => call.status === 'running')) return message;
			changed = true;
			return {
				...message,
				content: encodeToolCallBatch({
					...batch,
					calls: batch.calls.map(call =>
						call.status === 'running'
							? {
									...call,
									status: 'failed',
									error: call.error ?? 'no result recorded',
								}
							: call,
					),
				}),
			};
		});
		return changed ? next : previous;
	});
}
