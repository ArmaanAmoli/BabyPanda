import React, {
	createContext,
	SetStateAction,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import {SCROLL_ROWS, type MouseEvent} from '../utils/terminal/mouse';
import {useMouse} from '../hooks/useMouse';
import {useViewPortMessage} from '../hooks/useViewPortMessage';
import {
	findOffsetForMessage,
	selectVisibleMessages,
} from '../utils/selectVisibleMessages';
import type {VisibleMessage} from '../types';
import {useTerminal} from '../hooks/useTerminal';
import {HEIGHT_OF_PROMPT_BOX} from '../app';

interface VisibleMessageContextValue {
	visible: VisibleMessage[];
	offset: number;
	setOffset: React.Dispatch<SetStateAction<number>>;
	maxOffset: number;
	setFocusedMessageIndex: (messageIndex: number | null) => void;
	focusedMessageIndex: number | null;
	focusMessage: (messageIndex: number | null) => void;
	moveFocus: (direction: -1 | 1) => void;
}
export const VisibleMessageContext =
	createContext<VisibleMessageContextValue | null>(null);

export function VisibleMessageProvider({
	start,
	children,
}: {
	start: number;
	children: React.ReactNode;
}) {
	const {viewPortMessages} = useViewPortMessage();
	const {rows} = useTerminal();
	const end = rows - HEIGHT_OF_PROMPT_BOX;
	const budget = end - start + 1;
	const [offset, setOffset] = useState(0);
	const [focusedMessageIndex, setFocusedMessageIndex] = useState<number | null>(
		null,
	);
	const focusedMessageRef = useRef<number | null>(null);
	const {totalLines, maxOffset} = useMemo(() => {
		const total = viewPortMessages.reduce(
			(sum, message) => sum + message.lines.length,
			0,
		);
		return {
			totalLines: total,
			maxOffset: Math.max(0, total - 1),
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

	const focusMessage = (messageIndex: number | null) => {
		focusedMessageRef.current = messageIndex;
		setFocusedMessageIndex(messageIndex);

		if (messageIndex !== null) {
			const nextOffset = findOffsetForMessage(
				viewPortMessages,
				budget,
				messageIndex,
				maxOffset,
			);
			setOffset(nextOffset);
		}
	};

	const moveFocus = (direction: -1 | 1) => {
		const currentIndex = focusedMessageRef.current;
		if (currentIndex === null) {
			return;
		}

		const nextIndex = currentIndex + direction;
		if (direction === -1 && currentIndex === 0) {
			focusMessage(viewPortMessages.length - 1);
			return;
		}
		if (direction === 1 && currentIndex === viewPortMessages.length - 1) {
			focusMessage(0);
			return;
		}
		if (nextIndex < 0 || nextIndex >= viewPortMessages.length) {
			return;
		}

		focusMessage(nextIndex);
	};

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
		<VisibleMessageContext.Provider
			value={{
				visible,
				offset,
				setOffset,
				maxOffset,
				setFocusedMessageIndex: focusMessage,
				focusedMessageIndex,
				focusMessage,
				moveFocus,
			}}
		>
			{children}
		</VisibleMessageContext.Provider>
	);
}
