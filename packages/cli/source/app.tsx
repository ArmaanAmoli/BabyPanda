import React from 'react';
import { Text, Box, useStdout } from 'ink';
import { useState, useEffect , useRef} from 'react'
import {TextInput} from '@inkjs/ui'

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

		stdout.on('resize' , handleResize);

		return ()=>{
			stdout.off('resize' , handleResize)
		};

	},[stdout]);

	return (
		<Box flexDirection='column' width={dimensions.columns} height={dimensions.rows} borderStyle={'single'} borderColor={'white'}>
			<Text>Welcome to BabyPanda 🐼</Text>
			<Box>
				{/* convert this into a placeholder. */}
				<TextInput placeholder="How can I help you Today ?"></TextInput>
			</Box>
		</Box>
	);
}
