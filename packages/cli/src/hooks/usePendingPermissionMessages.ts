import {useContext} from 'react';
import {PendingPermissionMessagesContext} from '../context/pendingPermissionMessages';

export default function usePendingPermissionMessages() {
	const pendingPermissionMessagesObject = useContext(
		PendingPermissionMessagesContext,
	);
	if (!pendingPermissionMessagesObject) {
		throw new Error(
			'usePendingPermissionMessages must be used inside pending permission provider',
		);
	}
	return pendingPermissionMessagesObject;
}
