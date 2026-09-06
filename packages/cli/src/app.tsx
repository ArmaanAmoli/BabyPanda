import { Box, useStdout, Text, useInput } from 'ink';
import BigText from 'ink-big-text';
import { useState, useEffect, useContext, useRef } from 'react'
import PromptBox from './components/promptBox'
import { PromptContextProvider } from './context/prompt'
import { GlobalMessageQueueContextProvider, GlobalMessageQueueContext } from './context/messageQueueContext'
import { MessageBox } from './components/messageBox'
import { Role, type Message, type MessageDB } from './types';
import { getMessages, sendMessage } from './services/requests'
import { type ScrollViewRef, ScrollView } from 'ink-scroll-view'

export default function App() {
	const sessionId = '2d9dc32a-df6c-4685-8936-7be1598de04e'
	let i = 0;
	const [prompt, setPrompt] = useState('');
	const onChange = (value: string) => setPrompt(value);
	const onSubmit = async () => {
		setMessageHistory((prev)=>[...prev, {role:Role.user , content:prompt , createdAt:new Date , sessionId:sessionId}])
		const reader = await sendMessage({ role: Role.user, content: prompt, sessionId: sessionId });
		const textDecoder = new TextDecoder();
		let reply = "";
		let pushed = false
		while (true) {
			const { done, value } = await reader.read()
			if (done) {
				reply += textDecoder.decode();
				console.log(`CLI got the complete streamed reply`);
				break;
			}
			else {
				if (value) {
					const decodedText = textDecoder.decode(value, { stream: true });
					reply += decodedText
					if (!pushed) {
						setMessageHistory((prev) => [...prev , { role: Role.assistant, content: reply, createdAt: new Date, sessionId: sessionId }]);
						setPrompt('');
						pushed = true;
					}
					else {
						setMessageHistory((prev) => {
							let current = [...prev];
							const last = current.at(prev.length ? prev.length - 1 : 0);
							if (last) {
								last.content += decodedText;
							}
							return current;
						}
						)
					}
				}
			}
		}
	}
	const scrollRef = useRef<ScrollViewRef>(null);
	let [messageHistory, setMessageHistory] = useState<MessageDB[]>([]);
	const { queue, setQueue } = useContext(GlobalMessageQueueContext);
	const { stdout } = useStdout();
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

	useEffect(() => { //an Eventlistner to automatically resize the cli in case of user resize their terminal window
		if (!stdout) return;
		const handleResize = () => {
			setDimensions({
				columns: stdout?.columns || 80,
				rows: stdout?.rows || 24,
			});
		}
		stdout.on('resize', handleResize);
		return () => {
			stdout.off('resize', handleResize)
		};

	}, [stdout]);

	useEffect(() => {
		const getHistory = async () => {
			setMessageHistory(await getMessages('2d9dc32a-df6c-4685-8936-7be1598de04e'));
		}
		getHistory()
	}, []);

	return (
		<GlobalMessageQueueContextProvider>
			<PromptContextProvider>
				<Box flexDirection='column' width={dimensions.columns} height={dimensions.rows} padding={0} backgroundColor={'black'}>
					<Box height="100%" width="100%" paddingX={2} flexDirection='column'>
						<Box flexGrow={1} flexDirection='column'>
							{messageHistory.length === 0 && <BigText text="BABY PANDA" align='center' font="block" colors={['white']} />}
							<ScrollView ref={scrollRef} flexGrow={1} flexDirection='column' gap={2}>
								{messageHistory.length > 0 && messageHistory.map((message) => {
									return (<MessageBox key={i++} content={message.content as string} sended={true} role={message.role} />);
								})}
							</ScrollView>
						</Box>
						<Box height={6} minHeight={6} margin={0} width="100%">
							<PromptBox placeholder={"How can I help you ?"} value={prompt} onChange={onChange} onSubmit={onSubmit} />
						</Box>
					</Box>

				</Box>
			</PromptContextProvider>
		</GlobalMessageQueueContextProvider>
	);
}
