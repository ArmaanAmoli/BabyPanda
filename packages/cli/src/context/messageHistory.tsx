import React, {useEffect} from 'react';
import {useState, createContext, useRef} from 'react';
import type {CleanedMessage} from '@baby-panda/types';
import {useSession} from '../hooks/useSession';
import {getMessages} from '../services/requests';
import {MessagesContext} from '../types';
import {Role} from '@baby-panda/types';

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
	const lastRole = useRef<Role | null>(null);
	useEffect(() => {
		const getMessage = async () => {
			const messages = await getMessages(session.sessionId);
			setMessageHistory(messages);
		};
		getMessage();
	}, []);

	return (
		<MessageHistoryContext.Provider
			value={{messageHistory, setMessageHistory, lastRole}}
		>
			{children}
		</MessageHistoryContext.Provider>
	);
}
