import React, {createContext, useMemo, useRef, useState} from 'react';
import {useViewPortMessage} from '../hooks/useViewPortMessage';
import {getGroupForMessage, getMessageGroups} from '../utils/messageGroups';

interface VisibleMessageContextValue {
	focusedMessageIndex: number | null;
	focusMessage: (messageIndex: number | null) => void;
	moveFocus: (direction: -1 | 1) => void;
}
export const VisibleMessageContext =
	createContext<VisibleMessageContextValue | null>(null);

export function VisibleMessageProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const {viewPortMessages} = useViewPortMessage();
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
				focusedMessageIndex,
				focusMessage,
				moveFocus,
			}}
		>
			{children}
		</VisibleMessageContext.Provider>
	);
}
