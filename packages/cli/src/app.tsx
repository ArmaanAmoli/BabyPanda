import React from 'react';
import {Box, Text, useApp} from 'ink';
import {useState, useEffect, useRef} from 'react';
import PromptBox from './components/promptBox';
import {GAP_CHAT_BOX_PROMPT_BOX, PADDING_APP} from './layout';
import {getPromptLineCount, getPromptWrapWidth} from './utils/promptLayout';
import {
	getImageSegments,
	initializeImageIdFromHistory,
	isEmptyPrompt,
	promptText,
	textValue,
	type PromptValue,
} from './utils/promptValue';
import {buildUserContent, userContentToDisplay} from './utils/userContent';
import {
	CommandMenu,
	ProviderSetupBox,
	SlashCommandMenu,
	WebApiKeyBox,
} from './components/commandMenu';
import {ChatBox} from './components/ChatBox';
import {StatusBar} from './components/statusBar';
import {
	ContentType,
	ReasoningEffort,
	Role,
	WsEventTypes,
	EXA_PROVIDER,
} from '@baby-panda/types';
import type {WsEventMessage} from '@baby-panda/types';
import {getMessages, getProviders, saveProviderKey} from './services/requests';
import {getSessionName, renameSession} from './services/requests';
import {getWebApiKeys, saveWebApiKey} from './services/requests';
import {useSession} from './hooks/useSession';
import {
	PermissionBox,
	getPermissionBoxHeight,
} from './components/permissionBox';
import usePendingPermissionMessages from './hooks/usePendingPermissionMessages';
import {useMessageHistory} from './hooks/useMessageHistroy';
import useSocket from './hooks/useSocket';
import {useTerminal} from './hooks/useTerminal';
import type {Focused} from './types';
import {decodeToolCallBatch} from './types';
import {useToolCallUi} from './hooks/useToolCallUi';
import {useReasoningUi} from './hooks/useReasoningUi';
import {useInput} from 'ink';
import {useVisibleMessages} from './hooks/useVisibleMessages';
import {copyToClipboard} from './utils/copyToClipboard';
import {executeCommand} from './utils/commands/executeCommands';
import {getSkillsFiles} from '@baby-panda/utils';
import type {SkillFile} from '@baby-panda/utils';
import {splitSkillInvocation} from './utils/skillInvocation';
import {enqueuePendingSkillMessage} from './utils/pendingSkillMessages';
import {useSettings} from './hooks/useSettings';
import {useSpinnerFrame} from './components/spinner';
import {activityLabel} from './utils/activityLabel';
import {useToolCalls} from './hooks/useToolCalls';
import {getMessageGroups} from './utils/messageGroups';
import {buildTranscriptBoxes} from './utils/responseSlots';
import {getSlashMenuHeight, type SlashMenuEntry} from './utils/slashMenuLayout';

const SLASH_COMMANDS: {name: string; description: string}[] = [
	{name: 'provider', description: 'switch provider'},
	{name: 'model', description: 'switch model'},
	{name: 'efforts', description: 'set reasoning effort'},
	{name: 'sandbox', description: 'toggle shell sandbox'},
	{
		name: 'web-api-keys',
		description: 'add or change the Exa key for web search',
	},
	{name: 'api-key', description: 'change the Nvidia or Exa API key'},
	{name: 'rename-session', description: 'rename this session'},
];
export default function App() {
	const {exit} = useApp();
	const [focus, setFocus] = useState<Focused | null>('PromptBox');
	const socket = useSocket();
	const sessionState = useSession();
	const {pendingPermissionMessages} = usePendingPermissionMessages();
	const sessionId = sessionState.sessionId;
	// The label at the right edge of the status bar. It is read once and then
	// kept locally, so a rename is reflected without another round trip.
	const [sessionName, setSessionName] = useState('');
	const {messageHistory, setMessageHistory, lastRole} = useMessageHistory();
	const messageGroups = getMessageGroups(messageHistory);
	const [prompt, setPrompt] = useState<PromptValue>(() => textValue(''));
	const [isCommand, setIsCommand] = useState(false);
	const [skills, setSkills] = useState<SkillFile[]>([]);
	const [slashMenuOpen, setSlashMenuOpen] = useState(false);
	const [providersLoaded, setProvidersLoaded] = useState(false);
	const [providerLoadError, setProviderLoadError] = useState<string | null>(
		null,
	);
	const [setupProviderName, setSetupProviderName] = useState<string>();
	// Web tools are opt-in. `null` = still loading, `true` = a key is saved,
	// `false` = none saved (the prompt shows once, then the notice stays).
	const [webKeyConfigured, setWebKeyConfigured] = useState<boolean | null>(
		null,
	);
	const [showWebKeyPrompt, setShowWebKeyPrompt] = useState(false);
	// const [webKeyPromptDismissed, setWebKeyPromptDismissed] = useState(false);
	// `/api-key` flow: which credential is being changed — a model provider
	// name (e.g. Nvidia) or EXA_PROVIDER. `null` = no key-change box open.
	const [keyChangeTarget, setKeyChangeTarget] = useState<string | null>(null);
	const [clipboardStatus, setClipboardStatus] = useState<string>();
	const clipboardStatusTimer = useRef<
		ReturnType<typeof setTimeout> | undefined
	>(undefined);
	const {rows, columns} = useTerminal();
	const {focusMessage, moveFocus, focusedMessageIndex} = useVisibleMessages();
	const settings = useSettings();
	const {clearToolCalls} = useToolCalls();
	const {toggleGroup} = useToolCallUi();
	const {toggleReasoning} = useReasoningUi();
	const responding = settings.responding.responding;
	const spinnerFrame = useSpinnerFrame(responding);
	const statusLabel = activityLabel(
		settings.compaction.compacting,
		pendingPermissionMessages.length > 0,
	);
	const transcriptBoxes = buildTranscriptBoxes(messageHistory);
	const refreshSkills = () => {
		getSkillsFiles()
			.then(setSkills)
			.catch(error =>
				showClipboardStatus(`Skill loading failed: ${String(error)}`),
			);
	};
	const onChange = (value: PromptValue) => {
		const text = promptText(value);
		if (text.startsWith('/') && !promptText(prompt).startsWith('/')) {
			// entering slash mode: pick up skills added since startup and open the menu
			refreshSkills();
			setSlashMenuOpen(true);
		} else if (!text.startsWith('/')) {
			setSlashMenuOpen(false);
		}
		setIsCommand(text.startsWith('/'));
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
	const command = promptText(prompt).trim().split(/\s+/)[0];
	const showProviderMenu = isCommand && command === '/provider';
	const showModelMenu =
		isCommand && command === '/model' && activeProvider != null;
	const showEffortMenu =
		isCommand && command === '/efforts' && activeProvider != null;
	const showKeyMenu = isCommand && command === '/api-key';
	const keyMenuItems = React.useMemo(() => {
		const items = settings.providers.providers.map(provider => ({
			label: `${provider.provider} — model provider${
				provider.hasKey ? ' (key saved)' : ' (no key yet)'
			}`,
			value: provider.provider,
		}));
		items.push({
			label: `Exa — web search${webKeyConfigured ? ' (key saved)' : ' (no key yet)'}`,
			value: EXA_PROVIDER,
		});
		return items;
	}, [settings.providers.providers, webKeyConfigured]);
	const changeKeyProvider =
		keyChangeTarget != null && keyChangeTarget !== EXA_PROVIDER
			? settings.providers.providers.find(
					provider => provider.provider === keyChangeTarget,
				)
			: undefined;
	// The change box only makes sense once the mandatory provider setup is
	// done, so it never competes with the first-run provider prompt.
	const showChangeKeyBox =
		keyChangeTarget != null &&
		!needsProviderKey &&
		(changeKeyProvider != null || keyChangeTarget === EXA_PROVIDER);
	const slashQuery = isCommand ? (command ?? '').slice(1).toLowerCase() : '';
	const slashItems = React.useMemo(() => {
		const items: SlashMenuEntry[] = [];
		for (const cmd of SLASH_COMMANDS) {
			if (cmd.name.includes(slashQuery)) {
				items.push({
					name: cmd.name,
					description: cmd.description,
					value: `command:${cmd.name}`,
				});
			}
		}
		for (const skill of skills) {
			if (skill.name.includes(slashQuery)) {
				const hint = skill.argumentHint ? ` ${skill.argumentHint}` : '';
				items.push({
					name: `${skill.name}${hint}`,
					description: `${skill.description} (${skill.source})`,
					value: `skill:${skill.name}`,
				});
			}
		}
		return items;
	}, [skills, slashQuery]);
	const showSlashMenu =
		slashMenuOpen &&
		!showProviderMenu &&
		!showModelMenu &&
		!showEffortMenu &&
		!showKeyMenu &&
		slashItems.length > 0;
	const statusHeight = 1;
	const promptMaxHeight = Math.min(8, Math.max(3, Math.floor(rows * 0.25)));
	// While a paste chip is expanded the box grows so the pasted text is actually
	// readable, still leaving the chat area and status bar at least four rows.
	const expandedPromptMaxHeight = Math.max(
		promptMaxHeight,
		Math.min(Math.floor(rows * 0.6), Math.max(4, rows - 4)),
	);
	const hasExpandedPaste = prompt.segments.some(
		segment => segment.kind === 'paste' && !segment.collapsed,
	);
	const promptCeiling = hasExpandedPaste
		? expandedPromptMaxHeight
		: promptMaxHeight;
	const promptWidth = getPromptWrapWidth(columns, PADDING_APP);
	const promptLineCount = getPromptLineCount(prompt, promptWidth);
	const promptHeight = Math.min(promptCeiling, promptLineCount + 2);
	// the permission box grows with the command length so every option
	// stays visible; it is capped so the prompt and status bar keep room
	const permissionContent = pendingPermissionMessages.at(-1)?.content;
	const permissionBoxWidth = Math.max(
		10,
		Math.floor((columns - 2 * PADDING_APP) / 2),
	);
	const permissionContentHeight =
		permissionContent == null
			? 0
			: getPermissionBoxHeight(permissionContent, permissionBoxWidth);
	const permissionMaxHeight = Math.max(
		4,
		rows - statusHeight - promptHeight - GAP_CHAT_BOX_PROMPT_BOX - 1,
	);
	// The bottom activity area is reserved for permission prompts. Thinking
	// and compaction are signalled by the status-bar indicator, so ordinary
	// streaming hands these rows back to the chat.
	const activityHeight =
		pendingPermissionMessages.length > 0
			? Math.min(permissionContentHeight, permissionMaxHeight)
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
	// The Exa prompt is optional and comes second: while a provider key is
	// still missing it stays hidden, so the two never compete for keystrokes
	// and the provider is always resolved first.
	const webKeyPromptVisible =
		showWebKeyPrompt &&
		providersLoaded &&
		!needsProviderKey &&
		!providerLoadError;
	const webKeyPromptHeight = webKeyPromptVisible ? 5 : 0;
	const menuItemCount = showProviderMenu
		? settings.providers.providers.length
		: showModelMenu
			? (activeProvider?.models.length ?? 0)
			: showEffortMenu
				? settings.model.reasoningEfforts.length
				: 0;
	// Both change-key boxes carry a title, an escape hint and the input, so
	// they need 5 rows (the first-run provider setup box stays at 4).
	const changeKeyHeight = showChangeKeyBox ? 5 : 0;
	const menuLimit = Math.max(
		1,
		rows -
			statusHeight -
			promptHeight -
			activityHeight -
			setupHeight -
			changeKeyHeight -
			2,
	);
	const menuHeight =
		menuItemCount > 0 ? Math.min(menuItemCount, menuLimit) + 2 : 0;
	const keyMenuHeight = showKeyMenu
		? Math.min(keyMenuItems.length, menuLimit) + 2
		: 0;
	const slashMenuHeight = showSlashMenu
		? getSlashMenuHeight(slashItems.length, menuLimit)
		: 0;
	const bottomHeight =
		menuHeight +
		keyMenuHeight +
		slashMenuHeight +
		statusHeight +
		promptHeight +
		activityHeight +
		setupHeight +
		webKeyPromptHeight +
		changeKeyHeight;
	const chatHeight = Math.max(1, rows - bottomHeight - GAP_CHAT_BOX_PROMPT_BOX);

	useEffect(() => {
		refreshSkills();
	}, []);

	useEffect(() => {
		let cancelled = false;
		const loadProviders = async () => {
			try {
				const providers = await getProviders();
				if (cancelled) return;
				settings.providers.setProviders(providers);
				setProviderLoadError(null);
				if (!providers.some(provider => provider.hasKey)) {
					setSetupProviderName(undefined);
				}
				setProvidersLoaded(true);
			} catch (error) {
				if (cancelled) return;
				setProviderLoadError(String(error));
				// Don't set providersLoaded = true so the provider prompt
				// can still be shown on retry.
			}
		};
		loadProviders();
		return () => {
			cancelled = true;
		};
	}, []);

	// Web search is optional, so a missing key is not an error: prompt once at
	// startup and leave a notice behind if the user skips it.
	// Only check after providers have loaded so the NVIDIA key prompt
	// always appears first.
	useEffect(() => {
		if (!providersLoaded) return;
		void getWebApiKeys()
			.then(keys => {
				const configured = keys.some(
					key =>
						key.provider?.toLowerCase() === EXA_PROVIDER.toLowerCase() &&
						key.hasKey,
				);
				setWebKeyConfigured(configured);
				if (!configured) setShowWebKeyPrompt(true);
			})
			.catch(error => {
				setWebKeyConfigured(false);
				setShowWebKeyPrompt(true);
				showClipboardStatus(`Web key check failed: ${String(error)}`);
			});
	}, [providersLoaded]);

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
		setPrompt(textValue(''));
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
		setPrompt(textValue('/efforts'));
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
		setPrompt(textValue(''));
		setIsCommand(false);
	};

	const onSlashSelect = (value: string) => {
		setSlashMenuOpen(false);
		if (value.startsWith('skill:')) {
			// complete the input, do not submit; the user presses enter to send
			setPrompt(textValue(`/${value.slice('skill:'.length)} `));
			setIsCommand(true);
		} else {
			setPrompt(textValue(`/${value.slice('command:'.length)}`));
			setIsCommand(true);
		}
	};

	const onKeyMenuSelect = (value: string) => {
		setKeyChangeTarget(value);
		setSlashMenuOpen(false);
		setPrompt(textValue(''));
		setIsCommand(false);
	};

	const onSubmit = async () => {
		if (isEmptyPrompt(prompt)) {
			return;
		}
		const images = getImageSegments(prompt);
		if (isCommand) {
			if (showProviderMenu || showModelMenu || showEffortMenu || showKeyMenu)
				return;
			// Image chips are never skill arguments: the invocation is parsed
			// from the text only, with an image acting as a space so tokens
			// never merge across one. The images ride on the user message.
			const invocationText = prompt.segments
				.map(segment => (segment.kind === 'image' ? ' ' : segment.text))
				.join('');
			const parts = invocationText.trim().split(/\s+/);
			const token = (parts[0] ?? '').substring(1);
			// commands win collisions; otherwise a matching skill name activates the skill
			const skill = skills.find(item => item.name === token);
			if (skill) {
				setSlashMenuOpen(false);
				// only the declared positional arguments belong to the skill; the
				// leftover text is the user's message and waits for the skill to load
				const {args, message} = splitSkillInvocation(
					parts.slice(1),
					skill.arguments?.length ?? 0,
				);
				if (message || images.length > 0) {
					const placeholders = images.map(image => image.text).join(' ');
					const messageText = [message, placeholders].filter(Boolean).join(' ');
					enqueuePendingSkillMessage(
						skill.name,
						buildUserContent(messageText, prompt),
					);
				}
				const skillMessage: WsEventMessage = {
					eventType: WsEventTypes.skill,
					name: skill.name,
					...(args ? {args} : {}),
				};
				socket?.send(JSON.stringify(skillMessage));
				setPrompt(textValue(''));
				setIsCommand(false);
				return;
			}
			// Commands take text only; dropping pasted images silently would
			// surprise the user, so the submit is blocked instead.
			if (images.length > 0) {
				showClipboardStatus("Commands can't carry images — remove them first");
				return;
			}
			// execute command
			if (token === 'rename-session') {
				// everything after the command word, so a name may contain spaces
				const requested = invocationText
					.trim()
					.slice(token.length + 1)
					.trim();
				if (requested.length === 0) {
					showClipboardStatus('Usage: /rename-session <name>');
				} else {
					void renameSession(sessionId, requested)
						.then(name => {
							setSessionName(name);
							showClipboardStatus(`Session renamed to ${name}`);
						})
						.catch(error =>
							showClipboardStatus(`Rename failed: ${String(error)}`),
						);
				}
				setPrompt(textValue(''));
				setIsCommand(false);
				setSlashMenuOpen(false);
				return;
			}
			if (token === 'web-api-keys') {
				setPrompt(textValue(''));
				setIsCommand(false);
				setSlashMenuOpen(false);
				setShowWebKeyPrompt(true);
				return;
			}
			try {
				const setting = executeCommand(promptText(prompt));
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
			} catch (error) {
				// unknown slash input: local error only, nothing is sent
				showClipboardStatus(`Unknown command or skill: ${String(error)}`);
			}
			setPrompt(textValue(''));
			setIsCommand(false);
			setSlashMenuOpen(false);
			return;
		}
		const content = buildUserContent(promptText(prompt), prompt);
		setMessageHistory(prev => [
			...prev,
			{
				role: Role.user,
				content: userContentToDisplay(content),
				createdAt: Date.now(),
			},
		]);
		lastRole.current = Role.user;
		setPrompt(textValue(''));
		settings.responding.setResponding(true);
		clearToolCalls();

		const wsMessage: WsEventMessage = {
			eventType: WsEventTypes.message,
			role: Role.user,
			content,
		};
		socket?.send(JSON.stringify(wsMessage));
	};

	useEffect(() => {
		const loadSessionName = async () => {
			try {
				setSessionName(await getSessionName(sessionId));
			} catch (error) {
				// The status bar simply stays without a label; the session id
				// next to it still identifies the session.
				showClipboardStatus(`Session name unavailable: ${String(error)}`);
			}
		};
		loadSessionName();
	}, []);

	useEffect(() => {
		const getHistory = async () => {
			const history = await getMessages(sessionId);
			// Continue image numbering after the highest chip already in the
			// transcript, so a paste after a reload never reuses a name.
			initializeImageIdFromHistory(history.map(message => message.content));
			setMessageHistory(history);
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
		// Ctrl+C is handled here rather than left to Ink's `exitOnCtrlC`,
		// which compares the raw chunk with `input === '\x03'`. That misses
		// two real cases: a terminal reporting the key through the Kitty
		// keyboard protocol sends `ESC [ 99 ; 5 u` instead, and a chunk that
		// carries Ctrl+C alongside any other byte fails the exact match too.
		// `useInput` parses the keypress either way, so both arrive here as
		// ctrl + c.
		if (key.ctrl && _input === 'c') {
			exit();
			return;
		}
		// A chunk carrying Ctrl+C alongside any other byte parses as a single
		// unnamed keypress, so `key.ctrl` is false and the check above misses
		// it. The ETX byte is unambiguous wherever it appears.
		if (_input.includes('\u0003')) {
			exit();
			return;
		}
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
		if (_input === ' ' && focus === 'ChatBox' && focusedMessageIndex !== null) {
			// expand/collapse the focused reasoning block or tool-call group
			const focusedMessage = messageHistory[focusedMessageIndex];
			if (focusedMessage?.role === ContentType.reasoning_content) {
				// the reasoning key is the owning box's first message index,
				// matching the key ChatBox renders the block with
				const box = transcriptBoxes.find(
					candidate =>
						candidate.kind === 'reasoning' &&
						candidate.indices.includes(focusedMessageIndex),
				);
				if (box?.kind === 'reasoning') {
					toggleReasoning(`reasoning-${box.indices[0]}`);
				}
				return;
			}
			if (focusedMessage?.role === ContentType.tool_call) {
				const batch = decodeToolCallBatch(focusedMessage.content);
				if (batch) {
					toggleGroup(batch.id);
				}
			}
		}
		if (key.escape) {
			// Only the visible prompt is dismissible. Testing the raw flag
			// here would let an escape meant for the provider setup (or for
			// blurring focus) silently cancel the Exa prompt that is still
			// waiting its turn.
			if (webKeyPromptVisible) {
				setShowWebKeyPrompt(false);
				return;
			}
			if (showChangeKeyBox) {
				// cancel the change; the saved key is untouched
				setKeyChangeTarget(null);
				return;
			}
			if (showChangeKeyBox) {
				// cancel the change; the saved key is untouched
				setKeyChangeTarget(null);
				return;
			}
			if (slashMenuOpen) {
				setSlashMenuOpen(false);
				return;
			}
			if (focus != null) {
				setFocus(null);
				focusMessage(null);
			}
		}
	});

	return (
		<Box flexDirection="column" width={columns} height={rows} padding={0}>
			<Box
				height="100%"
				width="100%"
				paddingX={PADDING_APP}
				flexDirection="column"
				gap={GAP_CHAT_BOX_PROMPT_BOX}
			>
				<Box height={chatHeight} flexDirection="column" overflow="hidden">
					{/* Mouse rows are 1-based, so the chat region starts at row 1.
					    This also keeps the visible line count (end - start + 1)
					    equal to the container height (rows - HEIGHT_OF_PROMPT_BOX).
					    The banner is the first item inside ChatBox, so it scrolls
					    up with the transcript rather than being erased on input. */}
					<ChatBox height={chatHeight} sessionId={sessionId} />
				</Box>

				<Box
					flexDirection={'column'}
					width="100%"
					height={bottomHeight}
					justifyContent={'flex-end'}
					overflow="hidden"
				>
					{pendingPermissionMessages.length > 0 && (
						<Box height={activityHeight} width="50%">
							<PermissionBox />
						</Box>
					)}

					{needsProviderKey && !setupProvider && (
						<Box height={setupHeight} width="100%">
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

					{webKeyPromptVisible && (
						<Box height={webKeyPromptHeight} width="100%">
							<WebApiKeyBox
								onSubmit={key => {
									void saveWebApiKey(key)
										.then(() => {
											setWebKeyConfigured(true);
											setShowWebKeyPrompt(false);
											showClipboardStatus(
												'Exa API key saved — web search is enabled',
											);
										})
										.catch(error => {
											showClipboardStatus(
												`Could not save Exa key: ${String(error)}`,
											);
										});
								}}
							/>
						</Box>
					)}

					{showChangeKeyBox && changeKeyProvider && (
						<Box height={changeKeyHeight} width="100%">
							<ProviderSetupBox
								provider={changeKeyProvider}
								changeMode
								onSubmit={key => {
									void saveProviderKey(
										changeKeyProvider.provider,
										changeKeyProvider.endpoint,
										key,
									)
										.then(() => {
											settings.providers.setProviders(previous =>
												previous.map(provider =>
													provider.provider === changeKeyProvider.provider
														? {...provider, hasKey: true}
														: provider,
												),
											);
											// Only the active provider's key is held by the
											// running agent, so push it over the socket to apply
											// the change without a restart. Other providers pick
											// the new key up from the database when /provider
											// selects them.
											if (
												settings.model.provider === changeKeyProvider.provider
											) {
												socket?.send(
													JSON.stringify({
														eventType: WsEventTypes.setting,
														setting: {apiKey: key},
													}),
												);
											}
											setKeyChangeTarget(null);
											showClipboardStatus(
												`${changeKeyProvider.provider} API key updated`,
											);
										})
										.catch(error => {
											showClipboardStatus(
												`Could not save ${changeKeyProvider.provider} key: ${String(error)}`,
											);
										});
								}}
							/>
						</Box>
					)}

					{showChangeKeyBox && keyChangeTarget === EXA_PROVIDER && (
						<Box height={changeKeyHeight} width="100%">
							<WebApiKeyBox
								changeMode
								onSubmit={key => {
									void saveWebApiKey(key)
										.then(() => {
											setWebKeyConfigured(true);
											setKeyChangeTarget(null);
											showClipboardStatus(
												'Exa API key updated — web search is enabled',
											);
										})
										.catch(error => {
											showClipboardStatus(
												`Could not save Exa key: ${String(error)}`,
											);
										});
								}}
							/>
						</Box>
					)}

					{needsProviderKey && setupProvider && (
						<Box height={setupHeight} width="100%">
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

					{!needsProviderKey && !showWebKeyPrompt && (
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
							{showKeyMenu && (
								<CommandMenu
									title="Change which API key?"
									items={keyMenuItems}
									onSelect={onKeyMenuSelect}
									limit={menuLimit}
								/>
							)}
						</>
					)}

					{!needsProviderKey && !showWebKeyPrompt && !showChangeKeyBox && (
						<Box height={promptHeight} width="100%">
							<PromptBox
								placeholder={'Write a message... '}
								value={prompt}
								onChange={onChange}
								onSubmit={onSubmit}
								active={focus === 'PromptBox'}
								maxHeight={promptHeight}
								menuOpen={showSlashMenu}
								onStatus={showClipboardStatus}
							/>
						</Box>
					)}

					{/* The slash menu hangs off the bottom of the prompt box: the
					    box's own rule separates the input from the list, exactly as
					    the reference layout does. */}
					{showSlashMenu && (
						<Box height={slashMenuHeight} width="100%">
							<SlashCommandMenu
								items={slashItems}
								onSelect={onSlashSelect}
								limit={menuLimit}
							/>
						</Box>
					)}
					{!needsProviderKey && !showWebKeyPrompt && !showChangeKeyBox && (
						<Box height={statusHeight}>
							<StatusBar
								sessionId={sessionId}
								sessionName={sessionName}
								provider={settings.model.provider}
								model={settings.model.model}
								reasoningEffort={settings.model.reasoningEffort}
								contextWindow={settings.model.contextWindow}
								contextWindowUsed={settings.model.contextWindowUsed}
								responding={responding}
								spinnerFrame={spinnerFrame}
								statusLabel={statusLabel}
								webSearchOff={webKeyConfigured === false}
							/>
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
				>
					<Text color="#9fe3bd">{'Sandboxing Enabled'}</Text>
				</Box>
			)}
		</Box>
	);
}
