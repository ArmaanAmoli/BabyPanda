import {CleanedMessage} from '@baby-panda/types';
import React, {SetStateAction, useEffect, useState} from 'react';
import {createContext} from 'react';
import {useMessageHistory} from '../hooks/useMessageHistroy';
import {inViewPortMessages} from '../utils/inViewPortMessages';
import {useTerminal} from '../hooks/useTerminal';

export interface ViewPortMessageContextValue {
	viewPortMessages: CleanedMessage[];
	setViewPortMessages: React.Dispatch<SetStateAction<CleanedMessage[]>>;
}

export const ViewPortMessageContext =
	createContext<ViewPortMessageContextValue | null>(null);

export function ViewPortMessageProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const [viewPortMessages, setViewPortMessages] = useState<CleanedMessage[]>(
		[],
	);
	const {messageHistory} = useMessageHistory();
	const {rows} = useTerminal();

	useEffect(() => {
		setViewPortMessages(inViewPortMessages(messageHistory, rows, 0));
	}, []);

	return (
		<ViewPortMessageContext.Provider
			value={{viewPortMessages, setViewPortMessages}}
		>
			{children}
		</ViewPortMessageContext.Provider>
	);
}
