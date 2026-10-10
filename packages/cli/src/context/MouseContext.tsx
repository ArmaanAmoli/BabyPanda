import {useStdin} from 'ink';
import React, {useCallback, useEffect} from 'react';
import {createContext, useRef} from 'react';
import type {MouseHandler} from '../utils/terminal/mouse';

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

	let mouseBuffer = '';
	useEffect(() => {
		if (!mouseEventEnabled) {
			return;
		}
		const handleData = (data: Buffer | string) => {
			mouseBuffer += typeof data === 'string' ? data : data.toString();
			// parse mouse event.
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
