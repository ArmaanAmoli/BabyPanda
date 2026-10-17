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
import type {Focused} from './types';
import {useInput} from 'ink';
import {useVisibleMessages} from './hooks/useVisibleMessages';

export const HEIGHT_OF_PROMPT_BOX = 6;
export const PADDING_APP = 2;
export const GAP_CHAT_BOX_PROMPT_BOX = 1;
export default function App() {
	const [focus, setFocus] = useState<Focused | null>('ChatBox');
	const socket = useSocket();
	const sessionState = useSession();
	const {pendingPermissionMessages} = usePendingPermissionMessages();
	const sessionId = sessionState.sessionId;
	const {messageHistory, setMessageHistory, lastRole} = useMessageHistory();
	const [prompt, setPrompt] = useState('');
	const {rows, columns} = useTerminal();
	const {visible, focusMessage, moveFocus} = useVisibleMessages();

	const onChange = (value: string) => {
		setPrompt(value);
	};
	const onSubmit = async () => {
		if (prompt.trim().length === 0) {
			return;
		}
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

	useInput((_input, key) => {
		if (key.tab) {
			const newFocus: Focused = focus === 'ChatBox' ? 'PromptBox' : 'ChatBox';
			setFocus(newFocus);
			const recentMessage = visible.at(visible.length - 1);
			if (newFocus === 'ChatBox' && recentMessage) {
				focusMessage(recentMessage.messageIndex);
			} else if (newFocus === 'PromptBox') {
				focusMessage(null);
			}
		}

		if (key.upArrow) {
			if (focus === 'ChatBox') {
				moveFocus(-1);
			}
		}
		if (key.downArrow) {
			if (focus === 'ChatBox') {
				moveFocus(1);
			}
		}
		if (key.escape) {
			if (focus != null) {
				setFocus(null);
				focusMessage(null);
			}
		}
	});

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
				gap={GAP_CHAT_BOX_PROMPT_BOX}
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

					{/* Mouse rows are 1-based, so the chat region starts at row 1.
					    This also keeps the visible line count (end - start + 1)
					    equal to the container height (rows - HEIGHT_OF_PROMPT_BOX). */}
					<ChatBox />
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
