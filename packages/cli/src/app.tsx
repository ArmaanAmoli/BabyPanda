import React from 'react';
import {Box, Text} from 'ink';
import BigText from 'ink-big-text';
import {useState, useEffect, useRef} from 'react';
import PromptBox, {getWrappedLineCount} from './components/promptBox';
import {CommandMenu, ProviderSetupBox} from './components/commandMenu';
import {ChatBox} from './components/ChatBox';
import {ReasoningEffort, Role, WsEventTypes} from '@baby-panda/types';
import type {WsEventMessage} from '@baby-panda/types';
import {getMessages, getProviders, saveProviderKey} from './services/requests';
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
import {LodingIndicator} from './components/LodingIndicator';
import {ToolCallStatus} from './components/ToolCallStatus';
import {useToolCalls} from './hooks/useToolCalls';
import {getMessageGroups} from './utils/messageGroups';
import {APP_BACKGROUND_COLOR} from './theme';

export const PADDING_APP = 2;
export const GAP_CHAT_BOX_PROMPT_BOX = 1;
export default function App() {
	const [focus, setFocus] = useState<Focused | null>('ChatBox');
	const socket = useSocket();
	const sessionState = useSession();
	const {pendingPermissionMessages} = usePendingPermissionMessages();
	const sessionId = sessionState.sessionId;
	const {messageHistory, setMessageHistory, lastRole} = useMessageHistory();
	const messageGroups = getMessageGroups(messageHistory);
	const [prompt, setPrompt] = useState('');
	const [isCommand, setIsCommand] = useState(false);
	const [providersLoaded, setProvidersLoaded] = useState(false);
	const [setupProviderName, setSetupProviderName] = useState<string>();
	const [clipboardStatus, setClipboardStatus] = useState<string>();
	const clipboardStatusTimer = useRef<
		ReturnType<typeof setTimeout> | undefined
	>(undefined);
	const {rows, columns} = useTerminal();
	const {focusMessage, moveFocus, focusedMessageIndex} = useVisibleMessages();
	const settings = useSettings();
	const {clearToolCalls} = useToolCalls();
	const onChange = (value: string) => {
		setIsCommand(value.startsWith('/'));
		setPrompt(value);
	};
	const activeProvider =
		settings.providers.providers.find(
			provider => provider.provider === settings.model.provider,
		) ?? settings.providers.providers[0];
	const needsProviderKey =
		providersLoaded && activeProvider != null && !activeProvider.hasKey;
	const setupProvider = settings.providers.providers.find(
		provider => provider.provider === setupProviderName,
	);
	const command = prompt.trim().split(/\s+/)[0];
	const showProviderMenu = isCommand && command === '/provider';
	const showModelMenu =
		isCommand && command === '/model' && activeProvider != null;
	const showEffortMenu =
		isCommand && command === '/efforts' && activeProvider != null;
	const statusHeight = 1;
	const promptMaxHeight = Math.min(8, Math.max(3, Math.floor(rows * 0.25)));
	const promptWidth = Math.max(10, columns - 2 * PADDING_APP - 1);
	const promptLineCount = getWrappedLineCount(prompt, promptWidth);
	const promptHeight = Math.min(promptMaxHeight, promptLineCount + 2);
	const activityHeight =
		pendingPermissionMessages.length > 0
			? 4
			: settings.responding.responding
				? 4
				: 0;
	const setupItemCount = needsProviderKey
		? settings.providers.providers.length
		: 0;
	const setupLimit = Math.max(
		1,
		rows - statusHeight - promptHeight - activityHeight - 2,
	);
	const setupHeight = needsProviderKey
		? setupProvider
			? 4
			: Math.min(setupItemCount, setupLimit) + 2
		: 0;
	const menuItemCount = showProviderMenu
		? settings.providers.providers.length
		: showModelMenu
			? (activeProvider?.models.length ?? 0)
			: showEffortMenu
				? settings.model.reasoningEfforts.length
				: 0;
	const menuLimit = Math.max(
		1,
		rows - statusHeight - promptHeight - activityHeight - setupHeight - 2,
	);
	const menuHeight =
		menuItemCount > 0 ? Math.min(menuItemCount, menuLimit) + 2 : 0;
	const bottomHeight =
		menuHeight + statusHeight + promptHeight + activityHeight + setupHeight;
	const chatHeight = Math.max(1, rows - bottomHeight - GAP_CHAT_BOX_PROMPT_BOX);

	useEffect(() => {
		void getProviders()
			.then(providers => {
				settings.providers.setProviders(providers);
				if (!providers.some(provider => provider.hasKey)) {
					setSetupProviderName(undefined);
				}
				setProvidersLoaded(true);
			})
			.catch(error => {
				setProvidersLoaded(true);
				setClipboardStatus(`Provider loading failed: ${String(error)}`);
			});
	}, []);

	const selectProvider = (providerName: string) => {
		const provider = settings.providers.providers.find(
			item => item.provider === providerName,
		);
		const model = provider?.models[0];
		if (!provider || !model) return;
		settings.model.setModelState({
			provider: provider.provider,
			model: model.model,
			contextWindow: model.contextLength,
			contextWindowUsed: 0,
		});
		if (provider.hasKey) {
			socket?.send(
				JSON.stringify({
					eventType: WsEventTypes.setting,
					setting: {provider: provider.provider, model: model.model},
				}),
			);
		}
		setPrompt('');
		setIsCommand(false);
	};

	const selectModel = (modelName: string) => {
		const model = activeProvider?.models.find(item => item.model === modelName);
		if (!activeProvider || !model) return;
		settings.model.setModelState({
			provider: activeProvider.provider,
			model: model.model,
			contextWindow: model.contextLength,
			contextWindowUsed: 0,
			reasoningEfforts: model.reasoningEfforts,
			reasoningEffort: model.reasoningEfforts[0] ?? ReasoningEffort.none,
		});
		socket?.send(
			JSON.stringify({
				eventType: WsEventTypes.setting,
				setting: {
					provider: activeProvider.provider,
					model: model.model,
					reasoningEffort: model.reasoningEfforts[0] ?? ReasoningEffort.none,
				},
			}),
		);
		setPrompt('');
		setPrompt('/efforts');
		setIsCommand(true);
	};

	const selectEffort = (reasoningEffort: string) => {
		const selectedEffort = reasoningEffort as ReasoningEffort;
		settings.model.setModelState({reasoningEffort: selectedEffort});
		socket?.send(
			JSON.stringify({
				eventType: WsEventTypes.setting,
				setting: {reasoningEffort: selectedEffort},
			}),
		);
		setPrompt('');
		setIsCommand(false);
	};

	const onSubmit = async () => {
		if (prompt.trim().length === 0) {
			return;
		}
		if (isCommand) {
			if (showProviderMenu || showModelMenu || showEffortMenu) return;
			// execute command
			const setting = executeCommand(prompt);
			const wsMessage: WsEventMessage = {
				eventType: WsEventTypes.setting,
				setting,
			};

			if (setting.sandbox != undefined) {
				settings.sandbox.setSandBox(setting.sandbox);
			}
			if (setting.reasoningEffort !== undefined) {
				settings.model.setModelState({
					reasoningEffort: setting.reasoningEffort,
				});
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
		settings.responding.setResponding(true);
		clearToolCalls();

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
			const recentMessage = messageHistory.at(-1);
			if (newFocus === 'ChatBox' && recentMessage) {
				focusMessage(messageHistory.length - 1);
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
			const selectedGroup =
				focusedMessageIndex === null
					? undefined
					: messageGroups.find(group => group.includes(focusedMessageIndex));
			if (selectedGroup) {
				const content = selectedGroup
					.map(index => messageHistory[index]?.content)
					.filter((value): value is string => value !== undefined)
					.join('\n');
				void copyToClipboard(content)
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
			backgroundColor={APP_BACKGROUND_COLOR}
		>
			<Box
				height="100%"
				width="100%"
				paddingX={PADDING_APP}
				flexDirection="column"
				gap={GAP_CHAT_BOX_PROMPT_BOX}
			>
				<Box height={chatHeight} flexDirection="column">
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
					<ChatBox height={chatHeight} />
				</Box>

				<Box
					flexDirection={'column'}
					width="100%"
					height={bottomHeight}
					backgroundColor={APP_BACKGROUND_COLOR}
					justifyContent={'flex-end'}
				>
					{pendingPermissionMessages.length > 0 && (
						<Box
							height="100%"
							width="50%"
							backgroundColor={APP_BACKGROUND_COLOR}
						>
							<PermissionBox />
						</Box>
					)}

					{pendingPermissionMessages.length === 0 &&
						settings.responding.responding && (
							<Box
								height={4}
								flexDirection="column"
								width="100%"
								backgroundColor={APP_BACKGROUND_COLOR}
								paddingBottom={1}
							>
								<Box height={1} width="100%" marginBottom={1}>
									<ToolCallStatus />
								</Box>
								<Box height={1} flexDirection="row" width="100%">
									<LodingIndicator
										isResponding={settings.responding.responding}
									/>
								</Box>
							</Box>
						)}

					{needsProviderKey && !setupProvider && (
						<Box
							height={setupHeight}
							width="100%"
							backgroundColor={APP_BACKGROUND_COLOR}
						>
							<CommandMenu
								title="Choose a provider to get started"
								items={settings.providers.providers.map(provider => ({
									label: provider.provider,
									value: provider.provider,
								}))}
								onSelect={setSetupProviderName}
								limit={setupLimit}
							/>
						</Box>
					)}

					{needsProviderKey && setupProvider && (
						<Box
							height={setupHeight}
							width="100%"
							backgroundColor={APP_BACKGROUND_COLOR}
						>
							<ProviderSetupBox
								provider={setupProvider}
								onSubmit={key => {
									void saveProviderKey(
										setupProvider.provider,
										setupProvider.endpoint,
										key,
									)
										.then(() => {
											settings.providers.setProviders(previous =>
												previous.map(provider =>
													provider.provider === setupProvider.provider
														? {...provider, hasKey: true}
														: provider,
												),
											);
											const model = setupProvider.models[0];
											if (model) {
												settings.model.setModelState({
													provider: setupProvider.provider,
													model: model.model,
													contextWindow: model.contextLength,
													contextWindowUsed: 0,
												});
											}
											socket?.send(
												JSON.stringify({
													eventType: WsEventTypes.setting,
													setting: {
														apiKey: key,
														provider: setupProvider.provider,
														model: model?.model,
													},
												}),
											);
											setSetupProviderName(undefined);
										})
										.catch(error => {
											setClipboardStatus(
												`Provider setup failed: ${String(error)}`,
											);
										});
								}}
							/>
						</Box>
					)}

					{!needsProviderKey && (
						<>
							{showProviderMenu && (
								<CommandMenu
									title="Select provider"
									items={settings.providers.providers.map(provider => ({
										label: `${provider.provider}${
											provider.hasKey ? '' : ' (API key required)'
										}`,
										value: provider.provider,
									}))}
									onSelect={selectProvider}
									limit={menuLimit}
								/>
							)}
							{showModelMenu && (
								<CommandMenu
									title={`Models from ${activeProvider?.provider}`}
									items={(activeProvider?.models ?? []).map(model => ({
										label: model.model,
										value: model.model,
									}))}
									onSelect={selectModel}
									limit={menuLimit}
								/>
							)}
							{showEffortMenu && (
								<CommandMenu
									title="Select reasoning effort"
									items={settings.model.reasoningEfforts.map(effort => ({
										label: effort,
										value: effort,
									}))}
									onSelect={selectEffort}
									limit={menuLimit}
								/>
							)}
						</>
					)}

					{!needsProviderKey && (
						<Box
							height={promptHeight}
							width="100%"
							backgroundColor={APP_BACKGROUND_COLOR}
						>
							<PromptBox
								placeholder={'Write a message... '}
								value={prompt}
								onChange={onChange}
								onSubmit={onSubmit}
								active={focus === 'PromptBox'}
								start={rows - statusHeight - promptHeight + 1}
								end={rows - statusHeight}
								maxHeight={promptHeight}
							/>
						</Box>
					)}
					{!needsProviderKey && (
						<Box
							height={statusHeight}
							paddingX={1}
							backgroundColor={APP_BACKGROUND_COLOR}
						>
							<Text dimColor>
								Session {sessionId} · {settings.model.provider} ·{' '}
								{settings.model.model} · effort:{' '}
								{settings.model.reasoningEffort} ·{' '}
								{settings.model.contextWindow.toLocaleString()} context ·{' '}
								{settings.model.contextWindow
									? Math.round(
											(settings.model.contextWindowUsed /
												settings.model.contextWindow) *
												100,
										)
									: 0}
								% used
							</Text>
						</Box>
					)}
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
					backgroundColor={APP_BACKGROUND_COLOR}
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
					backgroundColor={APP_BACKGROUND_COLOR}
				>
					<Text color="#9fe3bd">{'Sandboxing Enabled'}</Text>
				</Box>
			)}
		</Box>
	);
}
