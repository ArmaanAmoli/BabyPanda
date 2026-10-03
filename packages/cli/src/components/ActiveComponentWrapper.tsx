import React, {useRef} from 'react';
import {useInput} from 'ink';
import {type ScrollViewRef, ScrollView} from 'ink-scroll-view';

export function ActiveComponentWrapper({
	isActive,
	// setIsActive,
	children,
}: {
	isActive: boolean;
	children: React.ReactNode;
}) {
	const scrollRef = useRef<ScrollViewRef>(null);
	useInput(
		(input, key) => {
			if (key.upArrow) {
				scrollRef.current?.scrollBy(-3); // Scroll up 1 line
			}
			if (key.downArrow) {
				scrollRef.current?.scrollBy(3); // Scroll down 1 line
			}
			if (key.pageUp) {
				// Scroll up by viewport height
				const height = scrollRef.current?.getViewportHeight() || 1;
				scrollRef.current?.scrollBy(-height);
			}
			if (key.pageDown) {
				const height = scrollRef.current?.getViewportHeight() || 1;
				scrollRef.current?.scrollBy(height);
			}
		},
		{isActive},
	);

	return (
		<ScrollView ref={scrollRef} flexGrow={1} flexDirection="column" gap={2}>
			{children}
		</ScrollView>
	);
}
