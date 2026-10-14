import {useContext} from 'react';
import {MessageHistoryContext} from '../context/MessageHistory';

export function useMessageHistory() {
	const messageHistoryContext = useContext(MessageHistoryContext);
	if (messageHistoryContext == null) {
		throw new Error(
			'useMessageHistory hook was not used under <MessageHistoryProvider>',
		);
	}
	return messageHistoryContext;
}
