import React from 'react';
import { Box, useStdout, Text, useInput } from 'ink';
import BigText from 'ink-big-text';
import Gradient from 'ink-gradient';
import { useState, useEffect, useContext, useRef } from 'react'
import PromptBox from './components/promptBox'
import { PromptContextProvider } from './context/prompt'
import { GlobalMessageQueueContextProvider, GlobalMessageQueueContext } from './context/messageQueueContext'
import { MessageBox } from './components/messageBox'
import { Role, type Message, type MessageDB } from './types';
import { getMessages } from './services/requests'
import { type ScrollViewRef, ScrollView } from 'ink-scroll-view'

export default function App() {
	let i = 0;
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
			scrollRef.current?.scrollBy(-1); // Scroll up 1 line
		}
		if (key.downArrow) {
			scrollRef.current?.scrollBy(1); // Scroll down 1 line
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
							{queue.length === 0 && messageHistory.length === 0 && <BigText text="BABY PANDA" align='center' font="block" colors={['white']} />}
							<ScrollView ref={scrollRef} flexGrow={1} flexDirection='column' gap={2}>
								{messageHistory.length > 0 && messageHistory.map((message) => {
									return (<MessageBox content={message.content as string} sended={true} role={message.role} />);
								})}
								{queue.map((messsage) => {
									return (<MessageBox content={messsage.message.content as string} sended={messsage.message.sended} role={Role.user} key={i++} />);
								})}
							</ScrollView>

						</Box>
						<Box height={6} margin={0} width="100%">
							<PromptBox placeholder={"How can I help you ?"} onSave={() => { }} />
						</Box>
					</Box>

				</Box>
			</PromptContextProvider>
		</GlobalMessageQueueContextProvider>
	);
}
