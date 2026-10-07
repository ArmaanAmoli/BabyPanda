import React from 'react';
import {Box, useStdout, useInput} from 'ink';
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
import {useActiveComponentState} from './hooks/useActiveComponentState';
import {useMessageHistory} from './hooks/useMessageHistroy';
import {ComponentName} from './types';
import useSocket from './hooks/useSocket';

export default function App() {
	const socket = useSocket();
	const sessionState = useSession();
	const {pendingPermissionMessages} = usePendingPermissionMessages();
	const sessionId = sessionState.sessionId;
	const {messageHistory, setMessageHistory} = useMessageHistory();
	const [prompt, setPrompt] = useState('');
	const onChange = (value: string) => setPrompt(value);

	const onSubmit = async () => {
		if (prompt.trim().length === 0) {
			return;
		}
		setMessageHistory(prev => [
			...prev,
			{role: Role.user, content: prompt, createdAt: Date.now()},
		]);
		setPrompt('');

		const wsMessage: WsEventMessage = {
			eventType: WsEventTypes.message,
			role: Role.user,
			content: prompt,
		};
		socket.send(JSON.stringify(wsMessage));
	};

	const {stdout} = useStdout();
	const [dimensions, setDimensions] = useState({
		columns: stdout?.columns || 80,
		rows: stdout?.rows || 24,
	});

	const activeComponentState = useActiveComponentState();
	const isActive = activeComponentState.get(ComponentName.chatBox)?.isActive;
	const setIsActive = activeComponentState.get(
		ComponentName.chatBox,
	)?.setIsActive;

	useInput((input, key) => {
		if (key.tab) {
			if (setIsActive !== undefined) {
				setIsActive(!isActive);
			}
		}
	});

	useEffect(() => {
		//an Eventlistner to automatically resize the cli in case of user resize their terminal window
		if (!stdout) return;
		const handleResize = () => {
			setDimensions({
				columns: stdout?.columns || 80,
				rows: stdout?.rows || 24,
			});
		};
		stdout.on('resize', handleResize);
		return () => {
			stdout.off('resize', handleResize);
		};
	}, [stdout]);

	useEffect(() => {
		const getHistory = async () => {
			setMessageHistory(await getMessages(sessionId));
		};
		getHistory();
	}, []);

	return (
		<Box
			flexDirection="column"
			width={dimensions.columns}
			height={dimensions.rows}
			padding={0}
			backgroundColor={'black'}
		>
			<Box height="100%" width="100%" paddingX={2} flexDirection="column">
				<Box flexGrow={1} flexDirection="column">
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
						isActive={isActive ?? false}
					/>
				</Box>
				{pendingPermissionMessages.length > 0 && (
					<Box height={12} width="50%">
						<PermissionBox />
					</Box>
				)}
				<Box
					height={6}
					minHeight={6}
					margin={0}
					width="100%"
					backgroundColor={'#242424'}
				>
					<PromptBox
						isActive={!isActive}
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
