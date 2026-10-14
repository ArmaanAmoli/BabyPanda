import React, {useCallback, useEffect} from 'react';
import {createContext, useRef} from 'react';
import type {MouseHandler, MouseEvent} from '../utils/terminal/mouse';
import {
	DOUBLE_CLICK_DISTANCE_TOLERANCE,
	DOUBLE_CLICK_THRESHOLD_MS,
} from '../utils/terminal/mouse';
import type {FilteredStdin} from '../utils/terminal/filterStdin';

interface MouseContextValue {
	subscribe: (handler: MouseHandler) => void;
	unsubscribe: (handler: MouseHandler) => void;
}
export const MouseContext = createContext<MouseContextValue | null>(null);

export function MouseProvider({
	children,
	mouseEventEnabled,
	filteredStdin,
}: {
	children: React.ReactNode;
	mouseEventEnabled: boolean;
	filteredStdin: FilteredStdin;
}) {
	if (!mouseEventEnabled) {
		return;
	}
	const subscribers = useRef<Set<MouseHandler>>(new Set()).current;
	const lastClickRef = useRef<{
		time: number;
		col: number;
		row: number;
	} | null>(null);

	const subscribe = useCallback(
		(handler: MouseHandler) => {
			subscribers.add(handler);
		},
		[subscribers],
	);

	const unsubscribe = useCallback(
		(handler: MouseHandler) => {
			subscribers.delete(handler);
		},
		[subscribers],
	);

	useEffect(() => {
		if (!mouseEventEnabled) {
			return;
		}

		const broadcast = (event: MouseEvent) => {
			let handled = false;
			for (const handler of subscribers) {
				if (handler(event) === true) {
					handled = true;
				}
			}

			if (event.name === 'left-press') {
				const now = Date.now();
				const lastClick = lastClickRef.current;
				if (
					lastClick &&
					now - lastClick.time < DOUBLE_CLICK_THRESHOLD_MS &&
					Math.abs(event.col - lastClick.col) <=
						DOUBLE_CLICK_DISTANCE_TOLERANCE &&
					Math.abs(event.row - lastClick.row) <= DOUBLE_CLICK_DISTANCE_TOLERANCE
				) {
					const doubleClickEvent: MouseEvent = {
						...event,
						name: 'double-click',
					};
					for (const handler of subscribers) {
						handler(doubleClickEvent);
					}
					lastClickRef.current = null;
				} else {
					lastClickRef.current = {time: now, col: event.col, row: event.row};
				}
			}

			if (
				!handled &&
				event.name === 'move' &&
				event.col >= 0 &&
				event.row >= 0 &&
				event.button === 'left'
			) {
				// Terminal apps only receive mouse move events when the mouse is down
				// so this always indicates a mouse drag that the user was expecting
				// would trigger text selection but does not as we are handling mouse
				// events not the terminal.
				// appEvents.emit(AppEvent.SelectionWarning);
			}
		};

		return filteredStdin.onMouse(broadcast);
	}, [filteredStdin, subscribers, mouseEventEnabled]);

	return (
		<MouseContext.Provider value={{subscribe, unsubscribe}}>
			{children}
		</MouseContext.Provider>
	);
}
