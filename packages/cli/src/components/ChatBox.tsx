import React, {useCallback, useEffect, useState} from 'react';
import {Box} from 'ink';
import type {CleanedMessage} from '@baby-panda/types';
import {MessageBox} from './messageBox';
import type {MouseEvent, MouseHandler} from '../utils/terminal/mouse';
import {useMouse} from '../hooks/useMouse';
import {SCROLL_ROWS} from '../utils/inViewPortMessages';
import {useViewPortMessage} from '../hooks/useViewPortMessage';
import {useRef} from 'react';
import {combineLinesToMessage} from '../utils/combineLinesToMessage';
import {MessageLine} from '../utils/breakIntoLines';
export function ChatBox({
	start,
	end,
}: {messageHistory: CleanedMessage[]} & {start: number; end: number}) {
	let k = 0;
	const {viewPortMessages} = useViewPortMessage();
	const [messageArray, setMessageArray] = useState<CleanedMessage[]>([]);
	const [currentlyVisibleArray, setCurrentlyVisibleArray] = useState<
		MessageLine[]
	>([]);
	const rows = end - start + 1;
	let j = viewPortMessages.length - 1;
	let i = j - rows - 1;
	const handler = useCallback<(event: MouseEvent) => void>(
		(event: MouseEvent) => {
			const lastLineIdx = viewPortMessages.length - 1;
			if (
				event.name === 'scroll-down' &&
				event.row >= start &&
				event.row <= end
			) {
				j = Math.min(lastLineIdx, j + SCROLL_ROWS);
				i = j - rows + 1;
				setCurrentlyVisibleArray(viewPortMessages.slice(i, j + 1));
			} else if (
				event.name === 'scroll-up' &&
				event.row >= start &&
				event.row <= end
			) {
				i = Math.max(start, i - SCROLL_ROWS);
				j = i + rows - 1;
				setCurrentlyVisibleArray(viewPortMessages.slice(i, j + 1));
			}
		},
		[viewPortMessages],
	);

	// const offset = useRef<number>(0);
	useMouse(handler);

	useEffect(() => {
		setCurrentlyVisibleArray(viewPortMessages.slice(i, j + 1));
	}, [viewPortMessages]);

	useEffect(() => {
		setMessageArray(combineLinesToMessage(currentlyVisibleArray));
	}, [currentlyVisibleArray]);

	return (
		// <ActiveComponentWrapper
		// 	start={0}
		// 	end={terminal.rows - HEIGHT_OF_PROMPT_BOX}
		// >
		<Box flexGrow={1} flexDirection="column">
			{messageArray.length > 0 &&
				messageArray.map(message => {
					return (
						<MessageBox
							key={k++}
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
