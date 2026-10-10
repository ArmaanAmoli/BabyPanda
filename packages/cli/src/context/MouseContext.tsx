import {useStdin} from 'ink';
import React, {useCallback, useEffect} from 'react';
import {createContext, useRef} from 'react';
import type {MouseHandler, MouseEvent} from '../utils/terminal/mouse';
import {ESC} from '../utils/terminal/input';
import {
	parseMouseEvent,
	DOUBLE_CLICK_DISTANCE_TOLERANCE,
	DOUBLE_CLICK_THRESHOLD_MS,
	isIncompleteMouseSequence,
} from '../utils/terminal/mouse';

interface MouseContextValue {
	subscribe: (handler: MouseHandler) => void;
	unsubscribe: (handler: MouseHandler) => void;
}
const MAX_MOUSE_BUFFER_SIZE = 4096;
export const MouseContext = createContext<MouseContextValue | null>(null);

export function MouseProvider({
	children,
	mouseEventEnabled,
}: {
	children: React.ReactNode;
	mouseEventEnabled: boolean;
}) {
	if (!mouseEventEnabled) {
		return;
	}
	const {stdin} = useStdin();
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

		let mouseBuffer = '';

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

		const handleData = (data: Buffer | string) => {
			mouseBuffer += typeof data === 'string' ? data : data.toString('utf-8');

			// Safety cap to prevent infinite buffer growth on garbage
			if (mouseBuffer.length > MAX_MOUSE_BUFFER_SIZE) {
				mouseBuffer = mouseBuffer.slice(-MAX_MOUSE_BUFFER_SIZE);
			}

			while (mouseBuffer.length > 0) {
				const parsed = parseMouseEvent(mouseBuffer);

				if (parsed) {
					broadcast(parsed.event);
					mouseBuffer = mouseBuffer.slice(parsed.length);
					continue;
				}

				if (isIncompleteMouseSequence(mouseBuffer)) {
					break; // Wait for more data
				}

				// Not a valid sequence at start, and not waiting for more data.
				// Discard garbage until next possible sequence start.
				const nextEsc = mouseBuffer.indexOf(ESC, 1);
				if (nextEsc !== -1) {
					mouseBuffer = mouseBuffer.slice(nextEsc);
					// Loop continues to try parsing at new location
				} else {
					mouseBuffer = '';
					break;
				}
			}
		};

		stdin.on('data', handleData);

		return () => {
			stdin.removeListener('data', handleData);
		};
	}, [stdin, subscribers, mouseEventEnabled]);

	return (
		<MouseContext.Provider value={{subscribe, unsubscribe}}>
			{children}
		</MouseContext.Provider>
	);
}
