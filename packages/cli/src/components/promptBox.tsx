import React from 'react';
import {Box, useInput} from 'ink';
import TextInput from 'ink-text-input';
import {type PromptBoxArgs} from '../types';
import {ActiveComponentWrapper} from './ActiveComponentWrapper';
import {useEffect} from 'react';
import {useActiveComponentState} from '../hooks/useActiveComponentState';
import {ComponentName} from '../types';
import type {TerminalMouseKey} from '../types';

export default function PromptBox({
	placeholder,
	value,
	onChange,
	onSubmit,
}: PromptBoxArgs) {
	const activeComponentState = useActiveComponentState();
	const isActive = activeComponentState.get(ComponentName.promptBox)?.isActive;
	const setIsActive = activeComponentState.get(
		ComponentName.promptBox,
	)?.setIsActive;

	useInput((input, key) => {
		if (key.tab && !isActive) {
			if (setIsActive !== undefined) {
				setIsActive(true);
			}
		}
	});
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
			<ActiveComponentWrapper isActive={isActive ?? false}>
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
