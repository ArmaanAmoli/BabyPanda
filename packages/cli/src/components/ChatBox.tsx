import React from 'react';
import {Box, useInput} from 'ink';
import {ActiveComponentWrapper} from './ActiveComponentWrapper';
import type {CleanedMessage} from '@baby-panda/types';
import {MessageBox} from './messageBox';
import {useActiveComponentState} from '../hooks/useActiveComponentState';
import {ComponentName} from '../types';
import {TerminalMouseKey} from '../types';

export function ChatBox({
	messageHistory,
}: {
	messageHistory: CleanedMessage[];
	height: number;
}) {
	const activeComponentState = useActiveComponentState();
	const isActive = activeComponentState.get(ComponentName.chatBox)?.isActive;
	const setIsActive = activeComponentState.get(
		ComponentName.chatBox,
	)?.setIsActive;
	let i = 0;

	useInput((input, key) => {
		if (key.tab && !isActive) {
			if (setIsActive !== undefined) {
				setIsActive(true);
			}
		}
	});

	return (
		<ActiveComponentWrapper isActive={isActive ?? false}>
			<Box flexGrow={1} flexDirection="column">
				{messageHistory.length > 0 &&
					messageHistory.map(message => {
						return (
							<MessageBox
								key={i++}
								content={message.content as string}
								role={message.role}
								createdAt={message.createdAt}
							/>
						);
					})}
			</Box>
		</ActiveComponentWrapper>
	);
}
