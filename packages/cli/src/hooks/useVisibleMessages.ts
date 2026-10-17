import {useContext} from 'react';
import {VisibleMessageContext} from '../context/VisibleMessages';

export function useVisibleMessages() {
	const visibleMessages = useContext(VisibleMessageContext);
	if (!visibleMessages) {
		throw new Error(
			'useVisibleMessage() not used within <VisibleMesageProvider>',
		);
	}
	return visibleMessages;
}
