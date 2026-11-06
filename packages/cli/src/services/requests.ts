import app, {getServerPort} from '@baby-panda/server';
// import type {APIProvider, Session} from '../types';
import {ContentType, LogType, Role} from '@baby-panda/types';
import type {ReasoningEffort} from '@baby-panda/types';
import type {ChatMessage} from '../types';
import {writeLogs} from '@baby-panda/utils';
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

/**
 * Turns a raw history entry returned by the server into a display message.
 * The server only JSON-parses each stored entry, so the shapes vary per role:
 * user messages are `{role, content}`, assistant messages are full
 * `AssistantMessage` records, tool messages are `{tool_call_id, content}` and
 * compaction summaries are plain strings.
 */
function toChatMessage(entry: unknown): ChatMessage[] {
	if (typeof entry === 'object' && entry !== null) {
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

		// Tool-call results are not part of the visible chat: during the run
		// they are only shown in the bottom status bar, and on reload they are
		// skipped entirely.
		if (role === Role.tool) {
			return [];
		}

		// Assistant messages carry their reasoning inline; render it as a
		// separate entry so its styling matches the streamed reasoning chunks.
		if (role === Role.assistant) {
			const reasoning = record.reasoning_content;
			const entries: ChatMessage[] = [];
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
			return entries;
		}

		return [{role, content, createdAt: null}];
	}

	return [{role: Role.compaction, content: String(entry), createdAt: null}];
}

export async function getMessages(sessionId: string): Promise<ChatMessage[]> {
	await writeLogs(LogType.cli, cwd, sessionId, 'Fetching Message History...');
	const req = new Request(`${getServerBaseUrl()}/get-messages`, {
		method: 'POST',
		body: JSON.stringify({sessionId}),
	});
	const res = await app.fetch(req);
	if (!res.ok) {
		await writeLogs(
			LogType.cli,
			cwd,
			sessionId,
			`[ERROR: ${res.status}]: Failed to fetch message history : ${res.statusText}`,
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
		await writeLogs(
			LogType.cli,
			cwd,
			sessionId,
			`[PARSE ERROR]: Failed to parse message history, expected an array`,
		);
		return [];
	}
	return messagesList.flatMap(message => toChatMessage(message));
}
