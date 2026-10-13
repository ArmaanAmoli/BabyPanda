import React from 'react';
import {Box} from 'ink';
import type {CleanedMessage} from '@baby-panda/types';
import {MessageBox} from './messageBox';
import type {MouseEvent, MouseHandler} from '../utils/terminal/mouse';
import {useMouse} from '../hooks/useMouse';
import {inViewPortMessages} from '../utils/inViewPortMessages';
import {useViewPortMessage} from '../hooks/useViewPortMessage';
import {useRef} from 'react';
import {useTerminal} from '../hooks/useTerminal';
export function ChatBox({
	messageHistory,
	start,
	end,
}: {messageHistory: CleanedMessage[]} & {start: number; end: number}) {
	let i = 0;
	const {viewPortMessages, setViewPortMessages} = useViewPortMessage();
	const {rows} = useTerminal();
	const offset = useRef(0);
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

	const handler: React.MutableRefObject<MouseHandler> = useRef<
		(event: MouseEvent) => void
	>((event: MouseEvent) => {
		if (
			event.name === 'scroll-down' &&
			event.row >= start &&
			event.row <= end
		) {
			//
		} else if (
			event.name === 'scroll-up' &&
			event.row >= start &&
			event.row <= end
		) {
			offset.current += 1;
			inViewPortMessages(messageHistory, rows, offset.current);
		}
	});
	useMouse(handler.current);

	return (
		// <ActiveComponentWrapper
		// 	start={0}
		// 	end={terminal.rows - HEIGHT_OF_PROMPT_BOX}
		// >
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
		// </ActiveComponentWrapper>
	);
}
