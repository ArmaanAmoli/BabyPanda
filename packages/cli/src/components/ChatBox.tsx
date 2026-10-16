import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Box} from 'ink';
import type {Role} from '@baby-panda/types';
import {
	MARGIN_TOP_MESSAGE_BOX,
	MessageBox,
	PADDING_MESSAGE_BOX,
} from './messageBox';
import {SCROLL_ROWS, type MouseEvent} from '../utils/terminal/mouse';
import {useMouse} from '../hooks/useMouse';
import {useViewPortMessage} from '../hooks/useViewPortMessage';
import type {ViewPortMessage} from '../context/ViewPortMessage';
import type {MessageLine} from '../utils/breakIntoLines';

// Rows a message box adds around its content: one margin above and padding on
// both the top and bottom.
const MESSAGE_OVERHEAD = MARGIN_TOP_MESSAGE_BOX + 2 * PADDING_MESSAGE_BOX;

interface VisibleMessage {
	messageIndex: number;
	role: Role;
	createdAt: number | null;
	content: string;
}

interface FlattenedLine {
	line: MessageLine;
	messageIndex: number;
}

// Picks the tail of the history that fits in `budget` terminal rows, opting to
// scroll `offset` content lines up from the bottom. Budgeting includes each
// message box's decoration so the result never overflows the container.
function selectVisibleMessages(
	messages: ViewPortMessage[],
	budget: number,
	offset: number,
): {visible: VisibleMessage[]; lineCount: number} {
	const flat: FlattenedLine[] = [];
	messages.forEach((message, messageIndex) => {
		message.lines.forEach(line => flat.push({line, messageIndex}));
	});

	const total = flat.length;
	const bottomIndex = Math.max(0, total - 1 - offset);
	const includedMessages = new Set<number>();
	const window: FlattenedLine[] = [];
	let used = 0;

	for (let index = bottomIndex; index >= 0; index--) {
		const entry = flat[index];
		if (!entry) break;
		const cost =
			1 + (includedMessages.has(entry.messageIndex) ? 0 : MESSAGE_OVERHEAD);
		if (used + cost > budget) break;
		used += cost;
		includedMessages.add(entry.messageIndex);
		window.unshift(entry);
	}

	const visible: VisibleMessage[] = [];
	let lineCount = 0;
	for (const entry of window) {
		lineCount++;
		const last = visible.at(-1);
		if (last && last.messageIndex === entry.messageIndex) {
			last.content += `\n${entry.line.content}`;
		} else {
			visible.push({
				messageIndex: entry.messageIndex,
				role: entry.line.role,
				createdAt: entry.line.createdAt,
				content: entry.line.content,
			});
		}
	}

	return {visible, lineCount};
}

export function ChatBox({start, end}: {start: number; end: number}) {
	const {viewPortMessages} = useViewPortMessage();

	const budget = end - start + 1;
	const [offset, setOffset] = useState(0);

	const {totalLines, maxOffset} = useMemo(() => {
		const total = viewPortMessages.reduce(
			(sum, message) => sum + message.lines.length,
			0,
		);
		const bottom = selectVisibleMessages(viewPortMessages, budget, 0);
		return {
			totalLines: total,
			maxOffset: Math.max(0, total - bottom.lineCount),
		};
	}, [viewPortMessages, budget]);

	// Follow new output while pinned to the bottom; otherwise shift the offset
	// by the number of new lines so the viewed content stays in place.
	const previousTotal = useRef(totalLines);
	useEffect(() => {
		const delta = totalLines - previousTotal.current;
		previousTotal.current = totalLines;
		if (delta > 0) {
			setOffset(previous => (previous === 0 ? 0 : previous + delta));
		}
	}, [totalLines]);

	const clampedOffset = Math.min(offset, maxOffset);

	const {visible} = useMemo(
		() => selectVisibleMessages(viewPortMessages, budget, clampedOffset),
		[viewPortMessages, budget, clampedOffset],
	);

	const handler = (event: MouseEvent) => {
		if (
			(event.name !== 'scroll-up' && event.name !== 'scroll-down') ||
			event.row < start ||
			event.row > end
		) {
			return;
		}

		setOffset(previous => {
			const delta = event.name === 'scroll-up' ? SCROLL_ROWS : -SCROLL_ROWS;
			return Math.max(0, Math.min(maxOffset, previous + delta));
		});
	};
	useMouse(handler);

	return (
		<Box flexGrow={1} flexDirection="column" justifyContent="flex-end">
			{visible.map(message => (
				<MessageBox
					key={message.messageIndex}
					content={message.content}
					role={message.role}
					createdAt={message.createdAt}
				/>
			))}
		</Box>
	);
}
