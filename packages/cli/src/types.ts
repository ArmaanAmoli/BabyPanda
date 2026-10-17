import type {Message, CleanedMessage} from '@baby-panda/types';
import type {SetStateAction} from 'react';
import React from 'react';
import {Role} from '@baby-panda/types';
import {RefObject} from 'hono/jsx';
export interface PromptBoxArgs {
	placeholder: string;
	value: string;
	onSubmit: () => void;
	onChange: (value: string) => void;
}

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
export type MessageStatusElement = Message & {sended: boolean};

export enum ComponentName {
	chatBox = 'chatBox',
	promptBox = 'promptBox',
}

export interface MessagesContext {
	messageHistory: CleanedMessage[];
	setMessageHistory: React.Dispatch<SetStateAction<CleanedMessage[]>>;
	lastRole: RefObject<Role | null>;
}

export type Focused = 'ChatBox' | 'PromptBox';

export interface VisibleMessage {
	messageIndex: number;
	role: Role;
	createdAt: number | null;
	content: string;
}

export interface FlattenedLine {
	line: MessageLine;
	messageIndex: number;
}

export interface MessageLine {
	role: Role;
	content: string;
	isFirstLine: boolean;
	createdAt: number | null;
	lineLength: number;
	isIncomplete?: boolean;
}

export interface ViewPortMessage {
	role: Role;
	createdAt: number | null;
	lines: MessageLine[];
}
