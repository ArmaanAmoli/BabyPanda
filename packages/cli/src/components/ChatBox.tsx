import React from 'react';
import {Box} from 'ink';
import {ActiveComponentWrapper} from './ActiveComponentWrapper';
import type {CleanedMessage} from '@baby-panda/types';
import {MessageBox} from './messageBox';

export function ChatBox({
	messageHistory,
	isActive,
}: {
	messageHistory: CleanedMessage[];
	isActive: boolean;
}) {
	let i = 0;
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
