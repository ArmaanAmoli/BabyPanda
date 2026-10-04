import React from 'react';
import {Box, useStdout, useInput} from 'ink';
import BigText from 'ink-big-text';
import {useState, useEffect} from 'react';
import PromptBox from './components/promptBox';
import {ChatBox} from './components/ChatBox';
import {
	LogType,
	Role,
	type CleanedMessage,
	ServerStreamChunkSchema,
	ContentType,
} from '@baby-panda/types';
import {getMessages, sendMessage} from './services/requests';
import {writeLogs, getProjectName} from '@baby-panda/utils';
import useSession from './hooks/useSession';
import {PermissionBox} from './components/permissionBox';
import usePendingPermissionMessages from './hooks/usePendingPermissionMessages';
import {useActiveComponentState} from './hooks/useActiveComponentState';
import {ComponentName} from './types';

export default function App() {
	const sessionState = useSession();
	const {pendingPermissionMessages} = usePendingPermissionMessages();
	const sessionId = sessionState.sessionId;
	const [messageHistory, setMessageHistory] = useState<CleanedMessage[]>([]);
	const [prompt, setPrompt] = useState('');
	const onChange = (value: string) => setPrompt(value);
	const projectName = getProjectName();

	const onSubmit = async () => {
		if (prompt.trim().length === 0) {
			return;
		}
		setMessageHistory(prev => [
			...prev,
			{role: Role.user, content: prompt, createdAt: Date.now()},
		]);
		setPrompt('');
		const reader = await sendMessage({
			role: Role.user,
			content: prompt,
			sessionId: sessionId,
		});
		const textDecoder = new TextDecoder();
		// let reply = "";
		let lastRole: Role | null = null;
		while (true) {
			const {done, value} = await reader.read();
			if (done) {
				const reply = textDecoder.decode();
				writeLogs(
					LogType.cli,
					projectName,
					sessionId,
					`CLI got the complete stream reply ${reply}`,
				);
				break;
			} else {
				if (value) {
					try {
						const decodedText = textDecoder.decode(value, {stream: true});
						writeLogs(
							LogType.cli,
							projectName,
							sessionId,
							`Chunk recieved trying to parse... ${decodedText}`,
						);
						const parsed = ServerStreamChunkSchema.safeParse(
							JSON.parse(decodedText),
						);
						if (!parsed.success) {
							writeLogs(
								LogType.cli,
								projectName,
								sessionId,
								`[PARSING ERROR]: ${parsed.error.issues}`,
							);
							continue;
						}
						writeLogs(LogType.cli, projectName, sessionId, `Chunk parsed`);
						const currentContentType = parsed.data?.contentType;
						const role =
							currentContentType === ContentType.tool_call
								? Role.tool
								: currentContentType === ContentType.thought
									? Role.thought
									: Role.assistant;

						if (lastRole == null || lastRole != role) {
							setMessageHistory(prev => [
								...prev,
								{
									role: role,
									content: parsed.data!.content,
									createdAt: Date.now(),
								},
							]);
							lastRole = role;
						} else {
							setMessageHistory(prev => {
								if (prev.length === 0) return prev;
								return prev.map((msg, index) => {
									if (index === prev.length - 1) {
										return {
											...msg,
											content: msg.content + (parsed.data.content ?? ''),
										};
									}
									return msg;
								});
							});
						}
					} catch (err) {
						writeLogs(
							LogType.cli,
							projectName,
							sessionId,
							`[STREAM PROCESSING ERROR]: ${err}`,
						);
						continue;
					}
				}
			}
		}
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
						isActive={isActive}
						// height={
						// 	pendingPermissionMessages.length == 0
						// 		? dimensions.rows
						// 		: dimensions.rows - 12
						// }
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
