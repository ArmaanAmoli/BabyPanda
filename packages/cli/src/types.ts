import type {ContentType, Role} from '@baby-panda/types';
import type {MutableRefObject, SetStateAction} from 'react';
import React from 'react';
import type {DOMElement} from 'ink';

export interface APIProvider {
	provider: string;
	endpoint: string;
	key: string;
}
export interface Session {
	id: string;
	createdAt: Date | null;
	parentSessionId: string | null;
	messagesCount: number | null;
}
export interface ReactChildPropInterface {
	children: React.ReactNode;
}

/**
 * Display message for the chat UI. History fetched from the server uses the
 * `Role` enum, while live stream chunks arriving over the WebSocket use the
 * `ContentType` enum (content / reasoning_content), so both are allowed here.
 */
export type ChatMessage = {
	role: Role | ContentType;
	content: string;
	createdAt: number | null;
};

export enum ComponentName {
	chatBox = 'chatBox',
	promptBox = 'promptBox',
}

export interface MessagesContext {
	messageHistory: ChatMessage[];
	setMessageHistory: React.Dispatch<SetStateAction<ChatMessage[]>>;
	lastRole: MutableRefObject<Role | ContentType | null>;
}

export type Focused = 'ChatBox' | 'PromptBox';

export interface MessageLine {
	role: Role | ContentType;
	content: string;
	isFirstLine: boolean;
	createdAt: number | null;
	lineLength: number;
	isIncomplete?: boolean;
}

export interface ViewPortMessage {
	role: Role | ContentType;
	createdAt: number | null;
	lines: MessageLine[];
}

export interface ScrollableEntry {
	id: string;
	ref: React.RefObject<DOMElement | null>;
	getScrollState(): {
		scrollTop: number;
		scrollHeight: number;
		innerHeight: number;
	};
	scrollBy(delta: number): void;
	scrollTo?(position: number): void;
	hasFocus?(): boolean;
}

export type DOMRef = React.RefObject<DOMElement | null>;

// ---------------------------------------------------------------------------
// Tool-call history entries
//
// A `ContentType.tool_call` chat entry stores one assistant message's tool
// call batch as a JSON-encoded ToolCallBatch in `content`. Live, the batch is
// appended when the WS `tool` event arrives and updated in place by
// `tool_result` events; on reload it is rebuilt from the assistant row's
// tool_calls plus the persisted tool rows. Both paths produce this shape.
// ---------------------------------------------------------------------------

export type ToolCallStatus = 'running' | 'done' | 'failed';

export interface ToolCallStats {
	lines?: number;
	added?: number;
	removed?: number;
	matches?: number;
	results?: number;
}

export interface ToolPageResult {
	url: string;
	success: boolean;
	error?: string;
}

export interface ToolCallEntry {
	id: string;
	name: string;
	arguments: Record<string, unknown>;
	status: ToolCallStatus;
	error?: string;
	/** File content immediately before a write/edit mutation; null = new file. */
	before?: string | null;
	stats?: ToolCallStats;
	/** get_web_page only: one outcome per requested URL. */
	pages?: ToolPageResult[];
}

export interface ToolCallBatch {
	id: string;
	calls: ToolCallEntry[];
	createdAt: number;
}

export function encodeToolCallBatch(batch: ToolCallBatch): string {
	return JSON.stringify(batch);
}

export function decodeToolCallBatch(content: string): ToolCallBatch | null {
	try {
		const parsed: unknown = JSON.parse(content);
		if (
			parsed != null &&
			typeof parsed === 'object' &&
			'id' in parsed &&
			typeof (parsed as {id: unknown}).id === 'string' &&
			'calls' in parsed &&
			Array.isArray((parsed as {calls: unknown}).calls)
		) {
			return parsed as ToolCallBatch;
		}
	} catch {
		// fall through
	}
	return null;
}
