import type {Message} from '@baby-panda/types';
import type {Key} from 'ink';
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

export type TerminalMouseKey = Key & {
	mouse?: {
		x: number;
		y: number;
		action: 'down' | 'up' | 'drag';
		button: 'left' | 'middle' | 'right' | 'none';
		isPressed: boolean;
	};
};
