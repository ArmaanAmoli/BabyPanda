import React, {useEffect, useState} from 'react';
import {Box, Text} from 'ink';

const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

interface LodingIndicatorProp {
	isResponding: boolean;
}

export function LodingIndicator({isResponding}: LodingIndicatorProp) {
	const [frame, setFrame] = useState(0);

	useEffect(() => {
		if (!isResponding) {
			setFrame(0);
			return;
		}

		const interval = setInterval(() => {
			setFrame(previousFrame => (previousFrame + 1) % spinnerFrames.length);
		}, 100);

		return () => {
			clearInterval(interval);
		};
	}, [isResponding]);

	if (!isResponding) {
		return null;
	}

	return (
		<Box>
			<Text color="white">{spinnerFrames[frame]} Thinking...</Text>
		</Box>
	);
}
