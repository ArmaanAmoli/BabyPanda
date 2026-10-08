import React, {useEffect, createContext, useRef, useState} from 'react';
import {ReactChildPropInterface} from '../types';
import {useSession} from '../hooks/useSession';
import {writeLogs} from '@baby-panda/utils';
import {LogType, WsCommonMessageSchema, WsEventTypes} from '@baby-panda/types';
import {UserPermissionSchema, ServerStreamChunkSchema} from '@baby-panda/types';
import usePendingPermissionMessages from '../hooks/usePendingPermissionMessages';
import {setTimeout} from 'node:timers';
import {getProjectName} from '@baby-panda/utils';
import {appendMessageHistory} from '../utils/appendMessageHistory';

export const SocketContext = createContext<WebSocket | null>(null);

const projectName = getProjectName();

export function SocketProvider({children}: ReactChildPropInterface) {
	const [socket, setSocket] = useState<WebSocket | null>(null);
	const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const reconnectDelayRef = useRef(1000);
	const session = useSession();
	const permissions = usePendingPermissionMessages();
	useEffect(() => {
		let isMounted = true;
		const url = new URL('ws://localhost:3000/ws');

		function connect() {
			if (!session) return;
			url.searchParams.set('sessionId', session.sessionId);
			const socketInstance: WebSocket = new WebSocket(url.toString());
			setSocket(socketInstance);

			socketInstance.onopen = () => {
				writeLogs(
					LogType.cli,
					projectName,
					session.sessionId,
					`[SOCKET]: opened`,
				);
			};

			socketInstance.onmessage = event => {
				writeLogs(
					LogType.cli,
					projectName,
					session.sessionId,
					`[WS]: ${event.data}`,
				);
				const data = event.data;
				const parsed = WsCommonMessageSchema.parse(JSON.parse(data));
				const {payload} = parsed;
				switch (parsed.eventType) {
					case WsEventTypes.message: {
						const chunk = ServerStreamChunkSchema.parse(payload);
						appendMessageHistory(chunk);
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
					session.sessionId,
					`[SOCKET]: error ${event.type}`,
				);
				socketInstance.close();
			};

			socketInstance.onclose = () => {
				if (isMounted) {
					socketInstance.close();
					writeLogs(
						LogType.cli,
						projectName,
						session.sessionId,
						`[SOCKET]: closed`,
					);
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
	}, [session?.sessionId]);

	return (
		<SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
	);
}

// permission pending array
// on message for permission => push in pending permission array => if pending Permission array not empty => show the permission pannel
