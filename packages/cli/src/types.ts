import type {Message, CleanedMessage} from '@baby-panda/types';
import type {SetStateAction} from 'react';
import type {Key} from 'ink';
export interface PromptBoxArgs {
	placeholder: string;
	value: string;
	onSubmit: () => void;
	onChange: (value: string) => void;
	isActive: boolean;
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
}
