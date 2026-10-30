import React from 'react';
import {createContext, useRef} from 'react';
import {ScrollableEntry, DOMRef} from '../types';
import {useMouse} from '../hooks/useMouse';
import {useFocus} from '../hooks/useFocus';
import {SCROLL_ROWS} from '../utils/terminal/mouse';

export interface ScrollContextValue {
	scrollables: Map<DOMRef, ScrollableEntry>;
}
export const ScrollContext = createContext<ScrollContextValue | null>(null);

export function ScrollProvider({children}: {children: React.ReactNode}) {
	const scrollablesRef = useRef(new Map<DOMRef, ScrollableEntry>());
	const {focus, setFocus} = useFocus();
	/*
	 */

	useMouse(event => {
		if (event.name !== 'scroll-down' && event.name !== 'scroll-up') return;
		const {row, col} = event;
		setFocus(row, col);
		if (focus != null && focus.current !== null) {
			const scrollable = scrollablesRef.current.get(focus);
			if (scrollable != undefined) {
				scrollable.scrollBy(
					event.name === 'scroll-up' ? -1 * SCROLL_ROWS : SCROLL_ROWS,
				);
			}
		}
	});

	return (
		<ScrollContext.Provider value={{scrollables: scrollablesRef.current}}>
			{children}
		</ScrollContext.Provider>
	);
}
