import React from 'react';
import {Box, useStdout, useInput} from 'ink';
import BigText from 'ink-big-text';
import {useState, useEffect, useRef} from 'react';
import PromptBox from './components/promptBox';
import {MessageBox} from './components/messageBox';
import {
	LogType,
	Role,
	type CleanedMessage,
	ServerStreamChunkSchema,
	ContentType,
} from '@baby-panda/types';
import {getMessages, sendMessage} from './services/requests';
import {type ScrollViewRef, ScrollView} from 'ink-scroll-view';
import {writeLogs, getProjectName} from '@baby-panda/utils';
import useSocket from './hooks/useSocket';
import useSession from './hooks/useSession';
import usePendingPermissionMessages from './hooks/usePendingPermissionMessages';

// interface AppArgs {
// 	sessionId: string;
// };

export default function App() {
	const sessionState = useSession();
	const {pendingPermissionMessages, setPendingPermissionMessages} =
		usePendingPermissionMessages();
	const socket = useSocket();
	const sessionId = sessionState.sessionId;
	let i = 0;
	const [messageHistory, setMessageHistory] = useState<CleanedMessage[]>([]);
	const [prompt, setPrompt] = useState('');
	const onChange = (value: string) => setPrompt(value);
	const projectName = getProjectName();

	const onSubmit = async () => {
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
								const current = [...prev];
								const last = current.at(prev.length ? prev.length - 1 : 0);
								if (last) {
									last.content += parsed.data!.content;
								}
								return current;
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

	const scrollRef = useRef<ScrollViewRef>(null);
	const {stdout} = useStdout();
	const [dimensions, setDimensions] = useState({
		columns: stdout?.columns || 80,
		rows: stdout?.rows || 24,
	});

	useInput((input, key) => {
		if (key.upArrow) {
			scrollRef.current?.scrollBy(-3); // Scroll up 1 line
		}
		if (key.downArrow) {
			scrollRef.current?.scrollBy(3); // Scroll down 1 line
		}
		if (key.pageUp) {
			// Scroll up by viewport height
			const height = scrollRef.current?.getViewportHeight() || 1;
			scrollRef.current?.scrollBy(-height);
		}
		if (key.pageDown) {
			const height = scrollRef.current?.getViewportHeight() || 1;
			scrollRef.current?.scrollBy(height);
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
					<ScrollView
						ref={scrollRef}
						flexGrow={1}
						flexDirection="column"
						gap={2}
					>
						{messageHistory.length > 0 &&
							messageHistory.map(message => {
								return (
									<MessageBox
										key={i++}
										content={message.content as string}
										role={message.role}
										createdAt={message.createdAt}
									/>
								);
							})}
					</ScrollView>
				</Box>
				<Box height={6} minHeight={6} margin={0} width="100%">
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
