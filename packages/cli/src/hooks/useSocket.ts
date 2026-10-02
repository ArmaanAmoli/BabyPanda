import {useContext} from 'react';
import {SocketContext} from '../context/webSocket';
import useSession from '../hooks/useSession';
import {writeLogs} from '@baby-panda/utils';
import {LogType} from '@baby-panda/types';

export default function useSocket() {
	const session = useSession();
	const socket = useContext<WebSocket | null>(SocketContext);
	if (!socket) {
		writeLogs(
			LogType.cli,
			process.cwd().replaceAll('/', '-').replace('-', ''),
			session ? session.sessionId : 'global',
			`[ERROR]: useSocket Hook not provided with SocketContext`,
		);
		return;
	}
	writeLogs(
		LogType.cli,
		process.cwd().replaceAll('/', '-').replace('-', ''),
		session ? session.sessionId : 'global',
		`RETURNING SOCKET`,
	);
	return socket;
}
