import React, {useRef} from 'react';
import {Box} from 'ink';
import {ActiveComponentWrapper} from './ActiveComponentWrapper';
import type {CleanedMessage} from '@baby-panda/types';
import {MessageBox} from './messageBox';
import {useTerminal} from '../hooks/useTerminal';
import {HEIGHT_OF_PROMPT_BOX} from '../app';
export function ChatBox({messageHistory}: {messageHistory: CleanedMessage[]}) {
	let i = 0;
	const terminal = useTerminal();

	/*
	How to figure out the length of the sliding window ?
	How to figure out the length of the message in terms of terminal
	rows and columns ? <- by finding this we will get the length of the sliding window
	
	problem can be solved by Bun.markdown.ansi(text, {columns:60})
	*/

	const rowsRef = useRef<number>(0);

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
								rowsRef={rowsRef}
							/>
						);
					})}
			</Box>
		</ActiveComponentWrapper>
	);
}
