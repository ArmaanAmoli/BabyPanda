import React, {SetStateAction, useEffect, useState} from 'react';
import {createContext} from 'react';
import {useMessageHistory} from '../hooks/useMessageHistroy';
import {useTerminal} from '../hooks/useTerminal';
import {breakMessageIntoLines, type MessageLine} from '../utils/breakIntoLines';
import {
	MARGIN_TOP_MESSAGE_BOX,
	PADDING_MESSAGE_BOX,
} from '../components/messageBox';
import {PADDING_APP} from '../app';

export interface ViewPortMessageContextValue {
	viewPortMessages: MessageLine[];
	setViewPortMessages: React.Dispatch<SetStateAction<MessageLine[]>>;
}

export const ViewPortMessageContext =
	createContext<ViewPortMessageContextValue | null>(null);

export function ViewPortMessageProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const [viewPortMessages, setViewPortMessages] = useState<MessageLine[]>([]);
	const {messageHistory} = useMessageHistory();
	const {columns} = useTerminal();

	useEffect(() => {
		const maxWidth =
			columns -
			(MARGIN_TOP_MESSAGE_BOX + 2 * PADDING_APP + 2 * PADDING_MESSAGE_BOX);
		let tempViewPortMessages: MessageLine[] = [];
		messageHistory.forEach(message => {
			tempViewPortMessages = [
				...tempViewPortMessages,
				...breakMessageIntoLines(message, maxWidth),
			];
		});
		setViewPortMessages(tempViewPortMessages);
	}, [columns, messageHistory]);

	return (
		<ViewPortMessageContext.Provider
			value={{viewPortMessages, setViewPortMessages}}
		>
			{children}
		</ViewPortMessageContext.Provider>
	);
}
