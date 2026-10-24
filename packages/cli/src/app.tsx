import React from 'react';
import {Box, Text} from 'ink';
import BigText from 'ink-big-text';
import {useState, useEffect, useRef} from 'react';
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
import {copyToClipboard} from './utils/copyToClipboard';
import {executeCommand} from './utils/commands/executeCommands';
import {useSettings} from './hooks/useSettings';

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
	const [isCommand, setIsCommand] = useState(false);
	const [clipboardStatus, setClipboardStatus] = useState<string>();
	const clipboardStatusTimer = useRef<
		ReturnType<typeof setTimeout> | undefined
	>(undefined);
	const {rows, columns} = useTerminal();
	const {visible, focusMessage, moveFocus, focusedMessageIndex} =
		useVisibleMessages();
	const settings = useSettings();
	const onChange = (value: string) => {
		if (value.at(0) === '/') {
			// potential command
			setIsCommand(true);
		}
		setPrompt(value);
	};
	const onSubmit = async () => {
		if (prompt.trim().length === 0) {
			return;
		}
		if (isCommand) {
			// execute command
			const setting = executeCommand(prompt);
			const wsMessage: WsEventMessage = {
				eventType: WsEventTypes.setting,
				setting,
			};
			if (setting.sandbox != undefined) {
				settings.sandbox.setSandBox(setting.sandbox);
			}
			socket?.send(JSON.stringify(wsMessage));
			setPrompt('');
			setIsCommand(false);
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

	useEffect(
		() => () => {
			if (clipboardStatusTimer.current) {
				clearTimeout(clipboardStatusTimer.current);
			}
		},
		[],
	);

	const showClipboardStatus = (status: string) => {
		setClipboardStatus(status);
		if (clipboardStatusTimer.current) {
			clearTimeout(clipboardStatusTimer.current);
		}
		clipboardStatusTimer.current = setTimeout(() => {
			setClipboardStatus(undefined);
		}, 2000);
	};

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
		if (_input === 'y' && focus === 'ChatBox') {
			const selectedMessage =
				focusedMessageIndex === null
					? undefined
					: messageHistory[focusedMessageIndex];
			if (selectedMessage) {
				void copyToClipboard(selectedMessage.content)
					.then(() => {
						showClipboardStatus('Copied to clipboard');
					})
					.catch(error => {
						showClipboardStatus(`Copy failed: ${String(error)}`);
					});
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
						active={focus === 'PromptBox'}
					/>
				</Box>
			</Box>
			{clipboardStatus && (
				<Box
					position="absolute"
					top={4}
					right={2}
					paddingX={1}
					paddingY={0}
					borderStyle="round"
					borderColor={
						clipboardStatus.startsWith('Copy failed') ? '#d66b6b' : '#7fc7a4'
					}
					backgroundColor="#242424"
				>
					<Text
						color={
							clipboardStatus.startsWith('Copy failed') ? '#f08a8a' : '#9fe3bd'
						}
					>
						{clipboardStatus}
					</Text>
				</Box>
			)}
			{settings.sandbox.sandbox && (
				<Box
					position="absolute"
					top={0}
					right={2}
					paddingX={1}
					paddingY={0}
					borderStyle="round"
					borderColor="#7fc7a4"
					backgroundColor="#242424"
				>
					<Text color="#9fe3bd">{'Sandboxing Enabled'}</Text>
				</Box>
			)}
		</Box>
	);
}
