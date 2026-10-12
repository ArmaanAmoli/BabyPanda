import React from 'react';
import {Box} from 'ink';
import {Role} from '@baby-panda/types';
import type {CleanedMessage} from '@baby-panda/types';
import {Markdown} from './markdown';

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

export function MessageBox({role, content}: CleanedMessage) {
	const color = getColor(role);
	return (
		<Box
			width="100%"
			justifyContent={'flex-start'}
			borderLeftColor={color}
			borderTop={false}
			borderBottom={false}
			borderRight={false}
			padding={1}
			marginTop={1}
			borderStyle={'bold'}
			backgroundColor={'#111111b0'}
		>
			<Markdown
				isThought={role === Role.thought ? true : false}
			>{`${content}`}</Markdown>
		</Box>
	);
}
