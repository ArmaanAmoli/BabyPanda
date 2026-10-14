import React from 'react';
import {Box} from 'ink';
import TextInput from 'ink-text-input';
import {type PromptBoxArgs} from '../types';
import {ActiveComponentWrapper} from './ActiveComponentWrapper';
import {useTerminal} from '../hooks/useTerminal';
import {GAP_CHAT_BOX_PROMPT_BOX, HEIGHT_OF_PROMPT_BOX} from '../app';
export default function PromptBox({
	placeholder,
	value,
	onChange,
	onSubmit,
}: PromptBoxArgs) {
	const terminal = useTerminal();
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
			<ActiveComponentWrapper
				start={
					terminal.rows - (HEIGHT_OF_PROMPT_BOX + GAP_CHAT_BOX_PROMPT_BOX) - 1
				}
				end={terminal.rows}
			>
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
