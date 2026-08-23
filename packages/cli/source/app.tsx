import React from 'react';
import { Box, useStdout } from 'ink';
import BigText from 'ink-big-text';
import Gradient from 'ink-gradient';
import { useState, useEffect } from 'react'
import PromptBox from './components/promptBox.js'

export default function App() {
	const { stdout } = useStdout();
	const [dimensions, setDimensions] = useState({
		columns: stdout?.columns || 80,
		rows: stdout?.rows || 24,
	});

	useEffect(() => { //an Eventlistner to automatically resize the cli in case of user resize theri terminal window
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
		<Box flexDirection='column' width={dimensions.columns} height={dimensions.rows} borderStyle={'single'} borderColor={'white'}>
			<Gradient name="pastel">
				<BigText text="BABY PANDA" align='center' font="block" />
			</Gradient>
			<PromptBox placeholder={"How can I help you"} onSave={() => { }} />
		</Box>
	);
}
