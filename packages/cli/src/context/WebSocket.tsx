import React, {useEffect, createContext, useRef, useState} from 'react';
import {ReactChildPropInterface} from '../types';
import {useSession} from '../hooks/useSession';
import {writeLogs} from '@baby-panda/utils';
import {LogType, WsCommonMessageSchema, WsEventTypes} from '@baby-panda/types';
import {UserPermissionSchema, ServerStreamChunkSchema} from '@baby-panda/types';
import usePendingPermissionMessages from '../hooks/usePendingPermissionMessages';
import {setTimeout} from 'node:timers';
import {getProjectName} from '@baby-panda/utils';
import {useMessageHistory} from '../hooks/useMessageHistroy';
import {appendMessageHistory} from '../utils/appendMessageHistory';
import {z} from 'zod';
import {useSettings} from '../hooks/useSettings';
import {useToolCalls} from '../hooks/useToolCalls';
import {getServerPort} from '@baby-panda/server';

export const SocketContext = createContext<WebSocket | null>(null);

const projectName = getProjectName();

function parseToolCall(content: string) {
	try {
		const parsed = z
			.object({
				name: z.string(),
				argument: z.record(z.string(), z.unknown()).optional(),
			})
			.parse(JSON.parse(content));
		const argument = parsed.argument ?? {};
		const importantArgument =
			typeof argument.command === 'string'
				? argument.command
				: typeof argument.path === 'string'
					? argument.path
					: typeof argument.query === 'string'
						? argument.query
						: undefined;
		return {
			name: parsed.name,
			content: importantArgument ?? '',
		};
	} catch {
		return {name: 'tool', content};
	}
}

export function SocketProvider({children}: ReactChildPropInterface) {
	const {sessionId} = useSession();
	const messageContext = useMessageHistory();
	const [socket, setSocket] = useState<WebSocket | null>(null);
	const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const reconnectDelayRef = useRef(1000);
	const setting = useSettings();
	const toolCallContext = useToolCalls();
	const permissions = usePendingPermissionMessages();
	useEffect(() => {
		let isMounted = true;
		const url = new URL(`ws://localhost:${getServerPort()}/ws`);

		function connect() {
			if (!sessionId) return;
			url.searchParams.set('sessionId', sessionId);
			const socketInstance: WebSocket = new WebSocket(url.toString());
			setSocket(socketInstance);

			socketInstance.onopen = async () => {
				await writeLogs(
					LogType.cli,
					projectName,
					sessionId,
					`[SOCKET]: opened`,
				);
			};

			socketInstance.onmessage = async event => {
				await writeLogs(
					LogType.cli,
					projectName,
					sessionId,
					`[WS]: ${event.data}`,
				);
				const data = event.data;
				const parsed = WsCommonMessageSchema.parse(JSON.parse(data));
				const {payload} = parsed;
				switch (parsed.eventType) {
					case WsEventTypes.message: {
						const chunk = ServerStreamChunkSchema.parse(payload);
						await appendMessageHistory(chunk, messageContext);
						break;
					}
					case WsEventTypes.permission: {
						const permission = UserPermissionSchema.parse(payload);
						permissions?.setPendingPermissionMessages(prev => [
							...prev,
							permission,
						]);
						break;
					}
					case WsEventTypes.setting: {
						const SettingSchema = z.object({end: z.boolean().optional()});
						const chunk = SettingSchema.parse(payload);
						if (chunk.end === true) {
							toolCallContext.clearToolCalls();
							setting.responding.setResponding(false);
						}
						break;
					}
					case WsEventTypes.tool: {
						const ToolSchema = z.object({
							role: z.string(),
							sessionId: z.string(),
							content: z.string(),
						});
						const parsedToolCalls = z
							.array(ToolSchema)
							.or(ToolSchema)
							.safeParse(payload);
						if (parsedToolCalls.success) {
							const calls = Array.isArray(parsedToolCalls.data)
								? parsedToolCalls.data
								: [parsedToolCalls.data];
							setting.responding.setResponding(true);
							toolCallContext.setToolCalls(
								calls.map(toolCall => parseToolCall(toolCall.content)),
							);
						} else {
							await writeLogs(
								LogType.cli,
								projectName,
								sessionId,
								`[WS]: Invalid tool payload ${JSON.stringify(payload)}`,
							);
						}
					}
				}
			};

			socketInstance.onerror = async event => {
				await writeLogs(
					LogType.cli,
					projectName,
					sessionId,
					`[SOCKET]: error ${event.type}`,
				);
				socketInstance.close();
			};

			socketInstance.onclose = async () => {
				if (isMounted) {
					socketInstance.close();
					await writeLogs(
						LogType.cli,
						projectName,
						sessionId,
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
	}, [sessionId]);

	return (
		<SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
	);
}
