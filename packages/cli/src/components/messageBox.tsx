import React from 'react';
import {Box, Text} from 'ink';
import {Role} from '@baby-panda/types';
import type {CleanedMessage} from '@baby-panda/types';
// import {Markdown} from './markdown';

export const PADDING_MESSAGE_BOX = 1;
export const MARGIN_TOP_MESSAGE_BOX = 1;

function getColor(role: Role) {
	if (role === Role.thought) {
		return '#863737';
	} else if (role === Role.assistant) {
		return '#7e7474';
	} else if (role === Role.tool) {
		return '#4d3838';
	} else {
		return '#f6eeee';
	}
}

export function MessageBox({
	role,
	content,
	isSelected,
}: CleanedMessage & {isSelected: boolean}) {
	const color = getColor(role);
	return (
		<Box
			width="100%"
			justifyContent={'flex-start'}
			// borderLeftColor={color}
			borderColor={color}
			borderTop={isSelected}
			borderBottom={isSelected}
			borderRight={isSelected}
			padding={PADDING_MESSAGE_BOX}
			marginTop={MARGIN_TOP_MESSAGE_BOX}
			borderStyle={'bold'}
			backgroundColor={'#111111b0'}
		>
			{/* <Markdown
				isThought={role === Role.thought ? true : false}
			>{`${content}`}</Markdown> */}
			<Text>{`${content}`}</Text>
		</Box>
	);
}
