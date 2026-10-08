import React, {useEffect} from 'react';
import {useState, createContext} from 'react';
import type {CleanedMessage} from '@baby-panda/types';
import {useSession} from '../hooks/useSession';
import {getMessages} from '../services/requests';
import {MessagesContext} from '../types';

export const MessageHistoryContext = createContext<MessagesContext | null>(
	null,
);

export function MessageHistoryProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const session = useSession();
	const [messageHistory, setMessageHistory] = useState<CleanedMessage[]>([]);
	useEffect(() => {
		const getMessage = async () => {
			const messages = await getMessages(session.sessionId);
			setMessageHistory(messages);
		};
		getMessage();
	}, []);

	return (
		<MessageHistoryContext.Provider value={{messageHistory, setMessageHistory}}>
			{children}
		</MessageHistoryContext.Provider>
	);
}
