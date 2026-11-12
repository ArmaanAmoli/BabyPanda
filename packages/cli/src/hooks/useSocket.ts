import {useContext} from 'react';
import {SocketContext} from '../context/WebSocket';
import {useSession} from '../hooks/useSession';
import {logError, getProjectName} from '@baby-panda/utils';
import {LogType} from '@baby-panda/types';

export default function useSocket() {
	const session = useSession();
	const socket = useContext<WebSocket | null>(SocketContext);
	if (!socket) {
		void (async () => {
			await logError(
				LogType.cli,
				getProjectName(),
				session ? session.sessionId : 'global',
				'useSocket hook was not provided a SocketContext',
			);
		})();
	}
	return socket;
}
