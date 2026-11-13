import React, {useEffect, createContext, useRef, useState} from 'react';
import {ReactChildPropInterface} from '../types';
import {useSession} from '../hooks/useSession';
import {logError, getProjectName} from '@baby-panda/utils';
import {
	ReasoningEffort,
	LogType,
	Role,
	WsCommonMessageSchema,
	WsEventTypes,
} from '@baby-panda/types';
import {
	UserPermissionSchema,
	ServerStreamChunkSchema,
	SkillEventPayloadSchema,
	CompactionEventPayloadSchema,
	WsToolCallRequestSchema,
	WsToolResultEventSchema,
} from '@baby-panda/types';
import usePendingPermissionMessages from '../hooks/usePendingPermissionMessages';
import {setTimeout} from 'node:timers';
import {useMessageHistory} from '../hooks/useMessageHistroy';
import {appendMessageHistory} from '../utils/appendMessageHistory';
import {
	appendToolCallBatch,
	applyToolResult,
	failRunningToolCalls,
} from '../utils/toolCallHistory';
import {z} from 'zod';
import {useSettings} from '../hooks/useSettings';
import {getServerPort} from '@baby-panda/server';

export const SocketContext = createContext<WebSocket | null>(null);

const projectName = getProjectName();

export function SocketProvider({children}: ReactChildPropInterface) {
	const {sessionId} = useSession();
	const messageContext = useMessageHistory();
	const [socket, setSocket] = useState<WebSocket | null>(null);
	const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const reconnectDelayRef = useRef(1000);
	const setting = useSettings();
	const permissions = usePendingPermissionMessages();
	useEffect(() => {
		let isMounted = true;
		const url = new URL(`ws://localhost:${getServerPort()}/ws`);

		function connect() {
			if (!sessionId) return;
			url.searchParams.set('sessionId', sessionId);
			const socketInstance: WebSocket = new WebSocket(url.toString());
			setSocket(socketInstance);

			socketInstance.onmessage = async event => {
				const data = event.data;
				// a single malformed message must never reject unhandled (that
				// would shut the CLI down) or drop a pending permission request
				// silently, so parse/dispatch errors are logged and swallowed
				try {
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
							const SettingSchema = z.object({
								end: z.boolean().optional(),
								provider: z.string().optional(),
								model: z.string().optional(),
								reasoningEffort: z.enum(ReasoningEffort).optional(),
								reasoningEfforts: z.array(z.enum(ReasoningEffort)).optional(),
								contextWindow: z.number().optional(),
								contextWindowUsed: z.number().optional(),
							});
							const chunk = SettingSchema.parse(payload);
							if (
								chunk.provider ||
								chunk.model ||
								chunk.contextWindow ||
								chunk.contextWindowUsed !== undefined
							) {
								const state: Partial<{
									provider: string;
									model: string;
									reasoningEffort: ReasoningEffort;
									reasoningEfforts: ReasoningEffort[];
									contextWindow: number;
									contextWindowUsed: number;
								}> = {};
								if (chunk.provider !== undefined)
									state.provider = chunk.provider;
								if (chunk.model !== undefined) state.model = chunk.model;
								if (chunk.reasoningEffort !== undefined)
									state.reasoningEffort = chunk.reasoningEffort;
								if (chunk.reasoningEfforts !== undefined)
									state.reasoningEfforts = chunk.reasoningEfforts;
								if (chunk.contextWindow !== undefined)
									state.contextWindow = chunk.contextWindow;
								if (chunk.contextWindowUsed !== undefined)
									state.contextWindowUsed = chunk.contextWindowUsed;
								setting.model.setModelState(state);
							}
							if (chunk.end === true) {
								failRunningToolCalls(messageContext);
								setting.responding.setResponding(false);
							}
							break;
						}
						case WsEventTypes.skill: {
							// the server confirms the skill was loaded into context
							// (or failed); only then is the notice shown
							const skillPayload = SkillEventPayloadSchema.parse(payload);
							const content = skillPayload.ok
								? `⚡ skill loaded: ${skillPayload.name}`
								: `⚡ skill failed to load: ${skillPayload.name}${
										skillPayload.error ? ` (${skillPayload.error})` : ''
									}`;
							messageContext.lastRole.current = Role.skill;
							messageContext.setMessageHistory(prev => [
								...prev,
								{role: Role.skill, content, createdAt: Date.now()},
							]);
							break;
						}
						case WsEventTypes.compaction: {
							const compactionEvent =
								CompactionEventPayloadSchema.parse(payload);
							setting.compaction.setCompacting(compactionEvent.compacting);
							break;
						}
						case WsEventTypes.tool: {
							const parsedToolCalls = z
								.array(WsToolCallRequestSchema)
								.safeParse(payload);
							if (parsedToolCalls.success) {
								setting.responding.setResponding(true);
								appendToolCallBatch(messageContext, parsedToolCalls.data);
							} else {
								await logError(
									LogType.cli,
									projectName,
									sessionId,
									`invalid tool payload: ${JSON.stringify(payload)}`,
									parsedToolCalls.error,
								);
							}
							break;
						}
						case WsEventTypes.tool_result: {
							const parsedResult = WsToolResultEventSchema.safeParse(payload);
							if (parsedResult.success) {
								applyToolResult(messageContext, parsedResult.data);
							} else {
								await logError(
									LogType.cli,
									projectName,
									sessionId,
									`invalid tool_result payload: ${JSON.stringify(payload)}`,
									parsedResult.error,
								);
							}
							break;
						}
					}
				} catch (error) {
					await logError(
						LogType.cli,
						projectName,
						sessionId,
						'failed to handle incoming message',
						error,
					);
				}
			};

			socketInstance.onerror = async event => {
				await logError(
					LogType.cli,
					projectName,
					sessionId,
					`socket error: ${event.type}`,
				);
				socketInstance.close();
			};

			socketInstance.onclose = async () => {
				if (isMounted) {
					socketInstance.close();
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
