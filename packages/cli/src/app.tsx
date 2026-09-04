import React from 'react';
import { Box, useStdout } from 'ink';
import BigText from 'ink-big-text';
import Gradient from 'ink-gradient';
import { useState, useEffect } from 'react'
import PromptBox from './components/promptBox'
import { PromptContextProvider } from './context/prompt'

export default function App() {
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

	return (
		<PromptContextProvider>
			<Box flexDirection='column' width={dimensions.columns} height={dimensions.rows} borderStyle={'single'} borderColor={'white'}>

				<Box flexGrow={1}>
					<Gradient name="pastel">
						<BigText text="BABY PANDA" align='center' font="block" />
					</Gradient>
				</Box>
				<Box height={6} margin={0} width="100%">
					<PromptBox placeholder={"How can I help you ?"} onSave={() => { }} />
				</Box>
			</Box>
		</PromptContextProvider>

	);
}
