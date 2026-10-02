import React, {FC} from 'react';
import {Box, Text, useFocus, useInput} from 'ink';

interface ButtonProps {
	label: string;
	onPress: () => void;
}

export const Button: FC<ButtonProps> = ({label, onPress}) => {
	const {isFocused} = useFocus();

	useInput((_input, key) => {
		if (isFocused && key.return) {
			onPress();
		}
	});

	return (
		<Box
			borderStyle={isFocused ? 'double' : 'single'}
			borderColor={isFocused ? 'cyan' : 'gray'}
			paddingX={2}
		>
			<Text color={isFocused ? 'cyan' : undefined} bold={isFocused}>
				{label}
			</Text>
		</Box>
	);
};
