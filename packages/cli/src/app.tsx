import React from 'react';
import { Box, useStdout , Text} from 'ink';
import BigText from 'ink-big-text';
import Gradient from 'ink-gradient';
import { useState, useEffect , useContext } from 'react'
import PromptBox from './components/promptBox'
import { PromptContextProvider } from './context/prompt'
import { GlobalMessageQueueContextProvider , GlobalMessageQueueContext } from './context/messageQueueContext'
import {MessageBox} from './components/messageBox'
import type { Message } from './types';

export default function App() {
	const {queue , setQueue} = useContext(GlobalMessageQueueContext);
	const { stdout } = useStdout();
	const [dimensions, setDimensions] = useState({
		columns: stdout?.columns || 80,
		rows: stdout?.rows || 24,
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

	useEffect(()=>{
		for(const element of queue){
			let {message , setMessage} = element;
			if(message.sended){
				continue;
			}
			const msg = message as Message;
			//send to agent
			message.sended = true;
		}
	}, [queue])

	return (
		<GlobalMessageQueueContextProvider>
			<PromptContextProvider>
				<Box flexDirection='column' width={dimensions.columns} height={dimensions.rows} padding={0}>
					<Box flexGrow={1}>
						{/* <BigText text="BABY PANDA" align='center' font="block" colors={['white']} /> */}
						<MessageBox content="you"/>
					</Box>
					<Box height={6} margin={0} width="100%">
						<PromptBox placeholder={"How can I help you ?"} onSave={() => { }} />
					</Box>
				</Box>
			</PromptContextProvider>
		</GlobalMessageQueueContextProvider>
	);
}
