import React from 'react';
import {Box} from 'ink';
import TextInput from 'ink-text-input';
import {type PromptBoxArgs} from '../types';
import {ActiveComponentWrapper} from './ActiveComponentWrapper';

export default function PromptBox({
	placeholder,
	value,
	onChange,
	onSubmit,
	isActive,
}: PromptBoxArgs) {
	return (
		<Box
			borderStyle={'single'}
			borderColor={'white'}
			width="100%"
			height="100%"
			backgroundColor={'black'}
		>
			<ActiveComponentWrapper isActive={isActive}>
				<TextInput
					value={value}
					placeholder={placeholder}
					onChange={onChange}
					onSubmit={onSubmit}
				/>
			</ActiveComponentWrapper>
		</Box>
	);
}
