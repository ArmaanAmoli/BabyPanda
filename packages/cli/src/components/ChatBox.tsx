import React from 'react';
import {Box} from 'ink';
import {ActiveComponentWrapper} from './ActiveComponentWrapper';
import type {CleanedMessage} from '@baby-panda/types';
import {MessageBox} from './messageBox';
import {useTerminal} from '../hooks/useTerminal';
import {HEIGHT_OF_PROMPT_BOX} from '../app';
export function ChatBox({messageHistory}: {messageHistory: CleanedMessage[]}) {
	let i = 0;
	const terminal = useTerminal();

	return (
		<ActiveComponentWrapper
			start={0}
			end={terminal.rows - HEIGHT_OF_PROMPT_BOX}
		>
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
