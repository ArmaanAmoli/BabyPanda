import app, {getServerPort} from '@baby-panda/server';
// import type {APIProvider, Session} from '../types';
import {ContentType, LogType, Role} from '@baby-panda/types';
import type {ReasoningEffort} from '@baby-panda/types';
import type {ChatMessage, ToolCallBatch, ToolCallEntry} from '../types';
import {encodeToolCallBatch} from '../types';
import {logError} from '@baby-panda/utils';
const cwd = process.cwd().replaceAll('/', '-').replace('-', '');
const getServerBaseUrl = () => `http://localhost:${getServerPort()}`;

export interface ProviderModel {
	model: string;
	contextLength: number;
	reasoningEfforts: ReasoningEffort[];
}

export interface ProviderInfo {
	provider: string;
	endpoint: string;
	hasKey: boolean;
	models: ProviderModel[];
}

export async function getProviders(): Promise<ProviderInfo[]> {
	const response = await app.fetch(
		new Request(`${getServerBaseUrl()}/providers`),
	);
	if (!response.ok) {
		throw new Error(`Unable to load providers (${response.status})`);
	}
	return (await response.json()) as ProviderInfo[];
}

export async function saveProviderKey(
	provider: string,
	endpoint: string,
	key: string,
) {
	const response = await app.fetch(
		new Request(`${getServerBaseUrl()}/add-provider`, {
			method: 'POST',
			headers: {'content-type': 'application/json'},
			body: JSON.stringify({provider, endpoint, key}),
		}),
	);
	if (!response.ok) {
		const details = await response.text();
		throw new Error(
			`Unable to save provider key (${response.status})${details ? `: ${details}` : ''}`,
		);
	}
}

const decoder = new TextDecoder();
function concatArrayBuffer(chunks: Uint8Array[]) {
	const result = new Uint8Array(
		chunks.reduce((accumulator, current) => {
			return accumulator + current.length;
		}, 0),
	);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.length;
	}
	return result;
}

export async function startSession() {
	const req = new Request(`${getServerBaseUrl()}/start-session`, {
		method: 'POST',
	});
	const res = await app.fetch(req);
	if (!res.ok) {
		return '';
	}
	const body = res.body;
	if (!body) return '';
	const chunks: Uint8Array[] = [];
	const reader = body.getReader();
	while (true) {
		const {done, value} = await reader.read();
		if (done) {
			console.log('stream ended');
			break;
		} else {
			chunks.push(value);
		}
	}
	const sessionIdUint = concatArrayBuffer(chunks);
	const sessionId = decoder.decode(sessionIdUint);
	return sessionId;
}
/* 
async function registerProvider(details: APIProvider) {
	const req = new Request(`${getServerBaseUrl()}/add-provider`, {
		method: 'POST',
		body: JSON.stringify(details),
	});
	try {
		const res = await app.fetch(req);
		if (!res.ok) {
			throw new Error(`${res.status}: ${res.statusText}`);
		}
		console.log('created');
	} catch (err) {
		console.error(`Error in sendPrompt function: `, err);
	}
}

async function getAllSessions(): Promise<Session[]> {
	const req = new Request(`${getServerBaseUrl()}/get-session`, {
		method: 'POST',
	});
	const res = await app.fetch(req);
	if (!res.ok) {
		return [];
	}
	const body = res.body;
	if (!body) return [];
	const chunks: Uint8Array[] = [];
	const reader = body.getReader();
	while (true) {
		const {done, value} = await reader.read();
		if (done) {
			console.log('stream ended');
			break;
		} else {
			chunks.push(value);
		}
	}
	const sessionsUint = concatArrayBuffer(chunks);
	const sessions = decoder.decode(sessionsUint);
	const sessionsList = JSON.parse(sessions) as Session[];
	return sessionsList;
}
 */
const isRole = (value: unknown): value is Role =>
	typeof value === 'string' && Object.values(Role).includes(value as Role);

interface BatchSlot {
	entryIndex: number;
	batch: ToolCallBatch;
}

function parseToolCallArguments(raw: unknown): Record<string, unknown> {
	if (typeof raw !== 'string') {
		return raw != null && typeof raw === 'object' && !Array.isArray(raw)
			? (raw as Record<string, unknown>)
			: {};
	}
	try {
		const parsed: unknown = JSON.parse(raw);
		return parsed != null &&
			typeof parsed === 'object' &&
			!Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: {};
	} catch {
		return {};
	}
}

/**
 * Turns the raw history rows returned by the server into display messages.
 * The server only JSON-parses each stored entry, so the shapes vary per role:
 * user messages are `{role, content}`, assistant messages are full
 * `AssistantMessage` records, tool rows are persisted result records.
 * Compaction rows are filtered out server-side and never arrive here.
 *
 * Assistant rows with `tool_calls` additionally produce one
 * `ContentType.tool_call` entry (a JSON-encoded ToolCallBatch) right after
 * them; each stored tool row is then merged into the batch that contains its
 * `tool_call_id`, so a reload renders the same tool-call blocks as the live
 * stream. Calls without a result row stay `running` in the last batch (the
 * agent may still be executing) and are marked failed in older batches.
 */
function buildChatMessages(messagesList: unknown[]): ChatMessage[] {
	const entries: ChatMessage[] = [];
	const batchSlots: BatchSlot[] = [];

	for (const entry of messagesList) {
		// non-object entries are malformed rows; nothing to render
		if (typeof entry !== 'object' || entry === null) {
			continue;
		}
		const record = entry as Record<string, unknown>;
		const content =
			typeof record.content === 'string'
				? record.content
				: record.content == null
					? ''
					: JSON.stringify(record.content);
		const role = isRole(record.role)
			? record.role
			: typeof record.tool_call_id === 'string'
				? Role.tool
				: Role.user;

		if (role === Role.tool) {
			// merge this result row into the batch that owns the call id
			const callId =
				typeof record.tool_call_id === 'string'
					? record.tool_call_id
					: typeof record.id === 'string'
						? record.id
						: undefined;
			if (callId != null) {
				for (let index = batchSlots.length - 1; index >= 0; index--) {
					const slot = batchSlots[index]!;
					const call = slot.batch.calls.find(item => item.id === callId);
					if (!call) continue;
					const success =
						typeof record.success === 'boolean'
							? record.success
							: typeof record.error === 'string'
								? false
								: true;
					call.status = success ? 'done' : 'failed';
					if (typeof record.error === 'string') call.error = record.error;
					if ('before' in record) call.before = record.before as string | null;
					if (record.stats != null && typeof record.stats === 'object') {
						call.stats = record.stats as ToolCallEntry['stats'];
					}
					if (Array.isArray(record.pages)) {
						call.pages = record.pages as ToolCallEntry['pages'];
					}
					const message = entries[slot.entryIndex]!;
					entries[slot.entryIndex] = {
						...message,
						content: encodeToolCallBatch(slot.batch),
					};
					break;
				}
			}
			continue;
		}

		if (role === Role.skill) {
			// Skill rows (outer role wins) render as a one-line loaded notice,
			// never as a user bubble with the whole SKILL.md body.
			const name = typeof record.name === 'string' ? record.name : '';
			entries.push({
				role: Role.skill,
				content: `⚡ skill loaded: ${name}`,
				createdAt: null,
			});
			continue;
		}

		if (role === Role.assistant) {
			// Assistant messages carry their reasoning inline; render it as a
			// separate entry so its styling matches the streamed reasoning chunks.
			const reasoning = record.reasoning_content;
			if (typeof reasoning === 'string' && reasoning.length > 0) {
				entries.push({
					role: ContentType.reasoning_content,
					content: reasoning,
					createdAt: null,
				});
			}
			if (content.length > 0) {
				entries.push({role, content, createdAt: null});
			}
			// one tool-call block per assistant message that asked for tools
			const toolCalls = record.tool_calls;
			if (Array.isArray(toolCalls) && toolCalls.length > 0) {
				const batch: ToolCallBatch = {
					id: `toolcall-reload-${entries.length}-${batchSlots.length}`,
					createdAt: 0,
					calls: toolCalls.map((rawCall, callIndex) => {
						const call = (rawCall ?? {}) as Record<string, unknown>;
						const fn = (call.function ?? {}) as Record<string, unknown>;
						return {
							id: typeof call.id === 'string' ? call.id : `call-${callIndex}`,
							name: typeof fn.name === 'string' ? fn.name : 'unknown',
							arguments: parseToolCallArguments(fn.arguments),
							status: 'running' as const,
						};
					}),
				};
				batchSlots.push({entryIndex: entries.length, batch});
				entries.push({
					role: ContentType.tool_call,
					content: encodeToolCallBatch(batch),
					createdAt: null,
				});
			}
			continue;
		}

		entries.push({role, content, createdAt: null});
	}

	// calls without a result row: running only in the last batch (possibly
	// still executing), failed everywhere else
	const lastSlot = batchSlots.at(-1);
	for (const slot of batchSlots) {
		const isLast = slot === lastSlot;
		for (const call of slot.batch.calls) {
			if (call.status !== 'running') continue;
			if (!isLast) {
				call.status = 'failed';
				call.error = call.error ?? 'no result recorded';
			}
		}
		if (slot.batch.calls.some(call => call.status !== 'running' || !isLast)) {
			const message = entries[slot.entryIndex]!;
			entries[slot.entryIndex] = {
				...message,
				content: encodeToolCallBatch(slot.batch),
			};
		}
	}

	return entries;
}

export async function getMessages(sessionId: string): Promise<ChatMessage[]> {
	const req = new Request(`${getServerBaseUrl()}/get-messages`, {
		method: 'POST',
		body: JSON.stringify({sessionId}),
	});
	const res = await app.fetch(req);
	if (!res.ok) {
		await logError(
			LogType.cli,
			cwd,
			sessionId,
			`failed to fetch message history (HTTP ${res.status} ${res.statusText})`,
		);
		return [];
	}
	const body = res.body;
	if (!body) return [];
	const chunks: Uint8Array[] = [];
	const reader = body.getReader();
	while (true) {
		const {done, value} = await reader.read();
		if (done) {
			console.log('stream ended');
			break;
		} else {
			chunks.push(value);
		}
	}
	const messagesUint = concatArrayBuffer(chunks);
	const messages = decoder.decode(messagesUint);
	const messagesList = JSON.parse(messages) as unknown;
	if (!Array.isArray(messagesList)) {
		await logError(
			LogType.cli,
			cwd,
			sessionId,
			'failed to parse message history, expected an array',
		);
		return [];
	}
	return buildChatMessages(messagesList);
}
