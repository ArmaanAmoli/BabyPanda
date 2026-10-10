import {useStdin} from 'ink';
import React, {useCallback, useEffect} from 'react';
import {createContext, useRef} from 'react';

type MouseEventName =
	| 'double-click'
	| 'left-press'
	| 'left-release'
	| 'middle-press'
	| 'middle-release'
	| 'move'
	| 'right-press'
	| 'right-release'
	| 'scroll-down'
	| 'scroll-left'
	| 'scroll-right'
	| 'scroll-up';

interface MouseEvent {
	name: MouseEventName;
	col: number;
	row: number;
	shift: boolean;
	ctrl: boolean;
	meta: boolean;
	button: 'left' | 'middle' | 'right' | 'none';
}

type MouseHandler = (event: MouseEvent) => void;

interface MouseContextValue {
	subscribe: (handler: MouseHandler) => void;
	unsubscribe: (handler: MouseHandler) => void;
}

const MouseContext = createContext<MouseContextValue | null>(null);

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
		const handleData = (data: Buffer | string) => {};

		stdin.on('data', handleData);

		return () => {
			stdin.removeListener('data', handleData);
		};
	}, []);

	return (
		<MouseContext.Provider value={{subscribe, unsubscribe}}>
			{children}
		</MouseContext.Provider>
	);
}
