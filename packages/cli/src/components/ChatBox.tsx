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
	// const revsedMessageHistory =[...messageHistory].reverse();

	/*
	How to figure out the length of the sliding window ?
	How to figure out the length of the message in terms of terminal
	rows and columns ? <- by finding this we will get the length of the sliding window
	*/

	/*
	. default scroll position
	. current scroll position
	. what is a scroll position ? start and end rows of message window
	. calculation to adjust gaps, margin, padding
	. GetMessageHeight() -> adjusts margin and padding with text height
	. Max content inside the Box should be equal to `terminal.rows`
		create a if condition that if sum of heights exceed in terminal rows
		stop the rendering.
	. Reverse message array rendering
	. We need to know the range from where to render
	. create a inViewPortMessages(framesize , framecount) -> returns messages in currentViewPort
		manage message slicing inside that for example if a message can completely fit
		we need to just return the fitted part and slice/remove the overflow.
		start by frameCount 0 -> most recent messages
		as the frameCount+=1 -> shift the window by -> SCROLL_COLUMNS
	. We can generate all possible frames ? traverse a window of size 80 rows
		over the message history array.
	*/
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
