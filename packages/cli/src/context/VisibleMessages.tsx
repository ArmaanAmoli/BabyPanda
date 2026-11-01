import React, {
	createContext,
	SetStateAction,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import {useViewPortMessage} from '../hooks/useViewPortMessage';
import {
	findOffsetForMessage,
	selectVisibleMessages,
} from '../utils/selectVisibleMessages';
import type {VisibleMessage} from '../types';
import {useTerminal} from '../hooks/useTerminal';
import {HEIGHT_OF_BOTTOM_CONTENT} from '../app';
import {getGroupForMessage, getMessageGroups} from '../utils/messageGroups';

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
	const end = rows - HEIGHT_OF_BOTTOM_CONTENT;
	const budget = end - start + 1;
	const [offset, setOffset] = useState(0);
	const [focusedMessageIndex, setFocusedMessageIndex] = useState<number | null>(
		null,
	);
	const focusedMessageRef = useRef<number | null>(null);
	const messageGroups = useMemo(
		() =>
			getMessageGroups(
				viewPortMessages.map(message => ({
					role: message.role,
					content: '',
					createdAt: message.createdAt,
				})),
			),
		[viewPortMessages],
	);
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
		if (messageIndex === null) {
			focusedMessageRef.current = null;
			setFocusedMessageIndex(null);
			return;
		}

		const groupIndex = getGroupForMessage(messageGroups, messageIndex);
		const normalizedIndex = messageGroups[groupIndex]?.[0] ?? messageIndex;
		focusedMessageRef.current = normalizedIndex;
		setFocusedMessageIndex(normalizedIndex);

		if (normalizedIndex !== null) {
			const nextOffset = findOffsetForMessage(
				viewPortMessages,
				budget,
				normalizedIndex,
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

		const currentGroup = getGroupForMessage(messageGroups, currentIndex);
		const nextGroup = currentGroup + direction;
		if (nextGroup < 0) {
			focusMessage(messageGroups.at(-1)?.[0] ?? null);
			return;
		}
		if (nextGroup >= messageGroups.length) {
			focusMessage(messageGroups[0]?.[0] ?? null);
			return;
		}

		focusMessage(messageGroups[nextGroup]?.[0] ?? null);
	};

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
