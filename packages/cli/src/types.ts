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
