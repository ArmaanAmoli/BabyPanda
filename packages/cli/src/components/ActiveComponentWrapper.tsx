import React, {useRef} from 'react';
import {type ScrollViewRef, ScrollView} from 'ink-scroll-view';
import {useMouse} from '../hooks/useMouse';
import {MouseEvent, MouseHandler, SCROLL_ROWS} from '../utils/terminal/mouse';

export function ActiveComponentWrapper({
	start,
	end,
	children,
}: {
	start: number;
	end: number;
	children: React.ReactNode;
}) {
	const scrollRef = useRef<ScrollViewRef>(null);
	const handler: MouseHandler = (event: MouseEvent) => {
		if (
			event.name === 'scroll-down' &&
			event.row >= start &&
			event.row <= end
		) {
			scrollRef.current?.scrollBy(SCROLL_ROWS);
		} else if (
			event.name === 'scroll-up' &&
			event.row >= start &&
			event.row <= end
		) {
			scrollRef.current?.scrollBy(-SCROLL_ROWS);
		}
	};
	useMouse(handler);

	return (
		<ScrollView ref={scrollRef} flexGrow={1} flexDirection="column" gap={2}>
			{children}
		</ScrollView>
	);
}
