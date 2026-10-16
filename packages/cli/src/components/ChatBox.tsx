import React, {useEffect, useRef, useState} from 'react';
import {Box} from 'ink';
import type {CleanedMessage} from '@baby-panda/types';
import {MessageBox} from './messageBox';
import type {MouseEvent} from '../utils/terminal/mouse';
import {useMouse} from '../hooks/useMouse';
import {useViewPortMessage} from '../hooks/useViewPortMessage';
import {combineLinesToMessage} from '../utils/combineLinesToMessage';

const SCROLL_ROWS = 2;

export function ChatBox({
	start,
	end,
}: {messageHistory: CleanedMessage[]} & {start: number; end: number}) {
	const {viewPortMessages} = useViewPortMessage();

	const rows = end - start + 1;
	const lineCount = viewPortMessages.length;
	const maxStart = Math.max(0, lineCount - rows);

	// `i` is the index of the first visible line. It is the single source of
	// truth for the scroll position, so the handler never has to read it back.
	const [i, setI] = useState(maxStart);

	// Pin the viewport to the bottom while output streams in, but keep the
	// user's scroll position if they have scrolled up.
	const previousLineCount = useRef(lineCount);
	useEffect(() => {
		const previousMaxStart = Math.max(0, previousLineCount.current - rows);
		setI(previousI =>
			previousI >= previousMaxStart ? maxStart : Math.min(previousI, maxStart),
		);
		previousLineCount.current = lineCount;
	}, [lineCount, rows, maxStart]);

	const handler = (event: MouseEvent) => {
		if (
			(event.name !== 'scroll-up' && event.name !== 'scroll-down') ||
			event.row < start ||
			event.row > end
		) {
			return;
		}

		setI(previousI => {
			const delta = event.name === 'scroll-up' ? -SCROLL_ROWS : SCROLL_ROWS;
			return Math.max(0, Math.min(maxStart, previousI + delta));
		});
	};
	useMouse(handler);

	const messageArray = combineLinesToMessage(
		viewPortMessages.slice(i, i + rows),
	);

	return (
		<Box flexGrow={1} flexDirection="column">
			{messageArray.map((message, index) => (
				<MessageBox
					key={index}
					content={message.content as string}
					role={message.role}
					createdAt={message.createdAt}
				/>
			))}
		</Box>
	);
}
