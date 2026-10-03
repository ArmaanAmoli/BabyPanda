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
			// borderStyle={'single'}
			// borderColor={'white'}
			paddingTop={1}
			paddingX={1}
			width="100%"
			height="100%"
			backgroundColor={'#242424'}
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
