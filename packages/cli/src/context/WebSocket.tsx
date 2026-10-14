import React, {useEffect, createContext, useRef, useState} from 'react';
import {ReactChildPropInterface} from '../types';
import {useSession} from '../hooks/useSession';
import {writeLogs} from '@baby-panda/utils';
import {LogType, WsCommonMessageSchema, WsEventTypes} from '@baby-panda/types';
import {UserPermissionSchema, ServerStreamChunkSchema} from '@baby-panda/types';
import usePendingPermissionMessages from '../hooks/usePendingPermissionMessages';
import {setTimeout} from 'node:timers';
import {getProjectName} from '@baby-panda/utils';
import {useTerminal} from '../hooks/useTerminal';
import {
	MARGIN_TOP_MESSAGE_BOX,
	PADDING_MESSAGE_BOX,
} from '../components/messageBox';
import {PADDING_APP} from '../app';
import {useViewPortMessage} from '../hooks/useViewPortMessage';
import {appendMessageLine} from '../utils/appendMessageHistory';

export const SocketContext = createContext<WebSocket | null>(null);

const projectName = getProjectName();

export function SocketProvider({children}: ReactChildPropInterface) {
	const {columns} = useTerminal();
	const {sessionId} = useSession();
	// const messageContext = useMessageHistory();
	const viewPortContext = useViewPortMessage();
	const [socket, setSocket] = useState<WebSocket | null>(null);
	const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const reconnectDelayRef = useRef(1000);
	const permissions = usePendingPermissionMessages();
	useEffect(() => {
		const maxWidth =
			columns -
			(MARGIN_TOP_MESSAGE_BOX + 2 * PADDING_APP + 2 * PADDING_MESSAGE_BOX);

		let isMounted = true;
		const url = new URL('ws://localhost:3000/ws');

		function connect() {
			if (!sessionId) return;
			url.searchParams.set('sessionId', sessionId);
			const socketInstance: WebSocket = new WebSocket(url.toString());
			setSocket(socketInstance);

			socketInstance.onopen = () => {
				writeLogs(LogType.cli, projectName, sessionId, `[SOCKET]: opened`);
			};

			socketInstance.onmessage = event => {
				writeLogs(LogType.cli, projectName, sessionId, `[WS]: ${event.data}`);
				const data = event.data;
				const parsed = WsCommonMessageSchema.parse(JSON.parse(data));
				const {payload} = parsed;
				switch (parsed.eventType) {
					case WsEventTypes.message: {
						const chunk = ServerStreamChunkSchema.parse(payload);
						// chunk.content = Bun.markdown.ansi(chunk.content, {
						// 	columns:
						// 		columns -
						// 		(MARGIN_TOP_MESSAGE_BOX +
						// 			2 * PADDING_APP +
						// 			2 * PADDING_MESSAGE_BOX),
						// });
						appendMessageLine(chunk, viewPortContext, maxWidth);
						break;
					}
					case WsEventTypes.permission: {
						const permission = UserPermissionSchema.parse(payload);
						permissions?.setPendingPermissionMessages(prev => [
							...prev,
							permission,
						]);
					}
				}
			};

			socketInstance.onerror = event => {
				writeLogs(
					LogType.cli,
					projectName,
					sessionId,
					`[SOCKET]: error ${event.type}`,
				);
				socketInstance.close();
			};

			socketInstance.onclose = () => {
				if (isMounted) {
					socketInstance.close();
					writeLogs(LogType.cli, projectName, sessionId, `[SOCKET]: closed`);
					reconnectTimeoutRef.current = setTimeout(() => {
						connect();
					}, reconnectDelayRef.current);
					isMounted = false;
				}
			};
		}

		connect();

		return () => {
			isMounted = false;
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
			}
			if (socket) {
				socket.close();
			}
		};
	}, [sessionId]);

	return (
		<SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
	);
}
