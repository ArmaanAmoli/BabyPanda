import React from 'react';
import {Box} from 'ink';
import BigText from 'ink-big-text';
import {useState, useEffect} from 'react';
import PromptBox from './components/promptBox';
import {ChatBox} from './components/ChatBox';
import {Role, WsEventTypes} from '@baby-panda/types';
import type {WsEventMessage} from '@baby-panda/types';
import {getMessages} from './services/requests';
import {useSession} from './hooks/useSession';
import {PermissionBox} from './components/permissionBox';
import usePendingPermissionMessages from './hooks/usePendingPermissionMessages';
import {useMessageHistory} from './hooks/useMessageHistroy';
import useSocket from './hooks/useSocket';
import {useTerminal} from './hooks/useTerminal';

export const HEIGHT_OF_PROMPT_BOX = 6;
export const PADDING_APP = 2;
export default function App() {
	const socket = useSocket();
	const sessionState = useSession();
	const {pendingPermissionMessages} = usePendingPermissionMessages();
	const sessionId = sessionState.sessionId;
	const {messageHistory, setMessageHistory, lastRole} = useMessageHistory();
	const [prompt, setPrompt] = useState('');
	const {rows, columns} = useTerminal();
	const onChange = (value: string) => {
		setPrompt(value);
	};
	const onSubmit = async () => {
		if (prompt.trim().length === 0) {
			return;
		}
		//Update this....
		// appendMessageLine({role: Role.user, content: prompt}, viewPort, maxWidth);
		setMessageHistory(prev => [
			...prev,
			{role: Role.user, content: prompt, createdAt: Date.now()},
		]);
		lastRole.current = Role.user;
		setPrompt('');

		const wsMessage: WsEventMessage = {
			eventType: WsEventTypes.message,
			role: Role.user,
			content: prompt,
		};
		socket?.send(JSON.stringify(wsMessage));
	};

	useEffect(() => {
		const getHistory = async () => {
			setMessageHistory(await getMessages(sessionId));
		};
		getHistory();
	}, []);

	return (
		<Box
			flexDirection="column"
			width={columns}
			height={rows}
			padding={0}
			backgroundColor={'black'}
		>
			<Box
				height="100%"
				width="100%"
				paddingX={PADDING_APP}
				flexDirection="column"
				gap={1}
			>
				<Box height={rows - HEIGHT_OF_PROMPT_BOX} flexDirection="column">
					{messageHistory.length === 0 && (
						<BigText
							text="BABY PANDA"
							align="center"
							font="block"
							colors={['white']}
						/>
					)}

					<ChatBox
						messageHistory={messageHistory}
						start={0}
						end={rows - HEIGHT_OF_PROMPT_BOX}
					/>
				</Box>

				{pendingPermissionMessages.length > 0 && (
					<Box height={12} width="50%" backgroundColor={'#242424'}>
						<PermissionBox />
					</Box>
				)}

				<Box
					height={HEIGHT_OF_PROMPT_BOX}
					width="100%"
					backgroundColor={'#242424'}
				>
					<PromptBox
						placeholder={'Write a message... '}
						value={prompt}
						onChange={onChange}
						onSubmit={onSubmit}
					/>
				</Box>
			</Box>
		</Box>
	);
}
