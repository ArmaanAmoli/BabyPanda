import React from 'react';
import {Box} from 'ink';
import {MessageBox} from './messageBox';
import {useVisibleMessages} from '../hooks/useVisibleMessages';

export function ChatBox() {
	const {visible, focusedMessageIndex} = useVisibleMessages();
	return (
		<Box flexGrow={1} flexDirection="column" justifyContent="flex-end">
			{visible.map(message => (
				<MessageBox
					key={message.messageIndex}
					content={message.content}
					role={message.role}
					createdAt={message.createdAt}
					isSelected={focusedMessageIndex === message.messageIndex}
				/>
			))}
		</Box>
	);
}
