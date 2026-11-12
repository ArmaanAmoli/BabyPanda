import React from 'react';
import {createContext, useCallback, useMemo, useRef} from 'react';
import {measureElement} from 'ink';
import type {ScrollableEntry} from '../types';
import {useMouse} from '../hooks/useMouse';
import {SCROLL_ROWS, type MouseEvent} from '../utils/terminal/mouse';
import {chainScroll} from '../utils/scrollChain';

export interface ScrollContextValue {
	register: (entry: ScrollableEntry) => void;
	unregister: (id: string) => void;
}
export const ScrollContext = createContext<ScrollContextValue | null>(null);

export function ScrollProvider({children}: {children: React.ReactNode}) {
	const scrollablesRef = useRef(new Map<string, ScrollableEntry>());

	const register = useCallback((entry: ScrollableEntry) => {
		scrollablesRef.current.set(entry.id, entry);
	}, []);

	const unregister = useCallback((id: string) => {
		scrollablesRef.current.delete(id);
	}, []);

	const findScrollables = useCallback((event: MouseEvent) => {
		const candidates = [...scrollablesRef.current.values()]
			.map(entry => {
				if (entry.ref.current == null) return null;
				const box = measureElement(entry.ref.current);
				const isInside =
					event.col >= box.x &&
					event.col < box.x + box.width &&
					event.row >= box.y &&
					event.row < box.y + box.height;
				return isInside ? {entry, area: box.width * box.height} : null;
			})
			.filter(
				(candidate): candidate is {entry: ScrollableEntry; area: number} =>
					Boolean(candidate),
			)
			// innermost first, so a wheel event starts at the smallest region
			// under the cursor and chains outwards once that one is exhausted
			.sort((left, right) => left.area - right.area);

		return candidates.map(candidate => candidate.entry);
	}, []);

	useMouse(event => {
		if (event.name !== 'scroll-down' && event.name !== 'scroll-up') return;

		chainScroll(
			findScrollables(event),
			event.name === 'scroll-up' ? -SCROLL_ROWS : SCROLL_ROWS,
		);
	});

	const value = useMemo(() => ({register, unregister}), [register, unregister]);

	return (
		<ScrollContext.Provider value={value}>{children}</ScrollContext.Provider>
	);
}
