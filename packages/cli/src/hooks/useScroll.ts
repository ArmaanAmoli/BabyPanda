import {useContext} from 'react';
import {ScrollableEntry} from '../types';
import {ScrollContext} from '../context/Scroll';

export function useScroll(scrollable: ScrollableEntry) {
	const scrollContext = useContext(ScrollContext);
	if (scrollContext == null) {
		throw new Error('useScroll must be used within ScrollProvider');
	}
	scrollContext.scrollables.set(scrollable.ref, scrollable);
}
