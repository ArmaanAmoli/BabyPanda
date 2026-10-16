import React, {SetStateAction, useEffect, useState} from 'react';
import {createContext} from 'react';
import {Role} from '@baby-panda/types';
import {useMessageHistory} from '../hooks/useMessageHistroy';
import {useTerminal} from '../hooks/useTerminal';
import {breakMessageIntoLines, type MessageLine} from '../utils/breakIntoLines';
import {
	MARGIN_TOP_MESSAGE_BOX,
	PADDING_MESSAGE_BOX,
} from '../components/messageBox';
import {PADDING_APP} from '../app';

// A single logical message together with its width-wrapped lines. Keeping the
// grouping lets the viewport budget for the decoration each message box adds
// (margin + padding) instead of assuming one content line equals one row.
export interface ViewPortMessage {
	role: Role;
	createdAt: number | null;
	lines: MessageLine[];
}

export interface ViewPortMessageContextValue {
	viewPortMessages: ViewPortMessage[];
	setViewPortMessages: React.Dispatch<SetStateAction<ViewPortMessage[]>>;
}

export const ViewPortMessageContext =
	createContext<ViewPortMessageContextValue | null>(null);

export function ViewPortMessageProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const [viewPortMessages, setViewPortMessages] = useState<ViewPortMessage[]>(
		[],
	);
	const {messageHistory} = useMessageHistory();
	const {columns} = useTerminal();

	useEffect(() => {
		const maxWidth =
			columns -
			(MARGIN_TOP_MESSAGE_BOX + 2 * PADDING_APP + 2 * PADDING_MESSAGE_BOX);
		setViewPortMessages(
			messageHistory.map(message => ({
				role: message.role,
				createdAt: message.createdAt,
				lines: breakMessageIntoLines(message, maxWidth),
			})),
		);
	}, [columns, messageHistory]);

	return (
		<ViewPortMessageContext.Provider
			value={{viewPortMessages, setViewPortMessages}}
		>
			{children}
		</ViewPortMessageContext.Provider>
	);
}
