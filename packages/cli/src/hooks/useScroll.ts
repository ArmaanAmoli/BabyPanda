import {useContext, useEffect, useRef, useState} from 'react';
import type {ScrollableEntry} from '../types';
import {ScrollContext} from '../context/Scroll';

let nextScrollableId = 0;

export function useScroll(
	scrollable: Omit<ScrollableEntry, 'id'>,
	isActive = true,
) {
	const scrollContext = useContext(ScrollContext);
	if (scrollContext == null) {
		throw new Error('useScroll must be used within ScrollProvider');
	}

	const [id] = useState(() => `scrollable-${nextScrollableId++}`);
	const latestEntry = useRef(scrollable);
	latestEntry.current = scrollable;

	useEffect(() => {
		if (!isActive) return;

		// Register stable forwarding functions. The scroll manager keeps this
		// object, while the ref below always points at the newest render.
		const entry: ScrollableEntry = {
			id,
			ref: latestEntry.current.ref,
			getScrollState: () => latestEntry.current.getScrollState(),
			scrollBy: delta => latestEntry.current.scrollBy(delta),
			scrollTo: position => latestEntry.current.scrollTo?.(position),
			hasFocus: () => latestEntry.current.hasFocus?.() ?? true,
		};
		scrollContext.register(entry);
		return () => {
			scrollContext.unregister(id);
		};
	}, [id, isActive, scrollContext]);
}
