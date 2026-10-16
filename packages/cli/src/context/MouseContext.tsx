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
	filteredStdin,
}: {
	children: React.ReactNode;
	filteredStdin: FilteredStdin;
}) {
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
		// Broadcast to every subscriber; each handler self-filters using the
		// event coordinates. There is intentionally no short-circuit: React
		// effect subscription order is not deterministic, so a "first handler
		// wins" scheme would have no stable priority.
		const broadcast = (event: MouseEvent) => {
			for (const handler of subscribers) {
				handler(event);
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
		};

		return filteredStdin.onMouse(broadcast);
	}, [filteredStdin, subscribers]);

	return (
		<MouseContext.Provider value={{subscribe, unsubscribe}}>
			{children}
		</MouseContext.Provider>
	);
}
