import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Box, type DOMElement} from 'ink';
import {useScroll} from '../hooks/useScroll';

export interface VirtualizedListProps<T> {
	data: readonly T[];
	renderItem: (args: {
		item: T;
		index: number;
		/** First visible terminal row of the item (1-based; the chat region starts at row 1). */
		startRow: number;
		/** How many of the item's top rows are clipped above the viewport. */
		clipTop: number;
		/** How many of the item's rows are visible in the viewport. */
		visibleRows: number;
	}) => React.ReactElement;
	keyExtractor: (item: T, index: number) => string;
	/**
	 * Return the number of terminal rows occupied by one item.
	 * The value may be an estimate; the list will still keep scrolling correct.
	 */
	getItemHeight: (item: T, index: number) => number;
	height: number;
	width?: number | string;
	/**
	 * When supplied, the list keeps this item inside the viewport.
	 * This is useful for keyboard navigation and does not change wheel scrolling.
	 */
	ensureVisibleIndex?: number | null;
	/**
	 * When true, the list stays anchored to the bottom while the user is at
	 * the bottom (used to anchor the active tool-call message while the agent
	 * responds). It never overrides a user who has scrolled up.
	 */
	forceStickToBottom?: boolean;
}

/**
 * Renders only the items that intersect the terminal viewport.
 *
 * The complete data array stays in the parent. This component only calculates
 * which indexes are visible and uses blank rows above and below them to keep
 * those items at their correct terminal position.
 */
export function VirtualizedList<T>({
	data,
	renderItem,
	keyExtractor,
	getItemHeight,
	height,
	width = '100%',
	ensureVisibleIndex = null,
	forceStickToBottom = false,
}: VirtualizedListProps<T>) {
	const viewportRef = useRef<DOMElement>(null);
	const [scrollTop, setScrollTop] = useState(0);
	const scrollTopRef = useRef(0);
	const targetScrollTopRef = useRef(0);
	const animationTimerRef = useRef<ReturnType<typeof setTimeout>>();
	const stickToBottomRef = useRef(true);
	const previousTotalHeight = useRef(0);
	const previousOffsets = useRef<number[]>([0]);

	const heights = useMemo(
		() => data.map((item, index) => Math.max(1, getItemHeight(item, index))),
		[data, getItemHeight],
	);
	const offsets = useMemo(() => {
		const result = [0];
		for (const itemHeight of heights) {
			result.push(result[result.length - 1] + itemHeight);
		}
		return result;
	}, [heights]);
	const totalHeight = offsets.at(-1) ?? 0;
	const maximumScrollTop = Math.max(0, totalHeight - height);

	const updateScrollTop = (next: number) => {
		scrollTopRef.current = next;
		setScrollTop(next);
	};

	const scheduleScrollAnimation = () => {
		if (animationTimerRef.current != null) return;

		const animate = () => {
			animationTimerRef.current = undefined;
			const current = scrollTopRef.current;
			const target = targetScrollTopRef.current;

			if (current === target) return;

			// Ink renders whole terminal rows, so moving one row per frame is
			// the smallest visible step and avoids large jumps during wheel bursts.
			const next = current + Math.sign(target - current);
			updateScrollTop(next);
			animationTimerRef.current = setTimeout(animate, 16);
		};

		animationTimerRef.current = setTimeout(animate, 16);
	};

	useEffect(
		() => () => {
			if (animationTimerRef.current != null) {
				clearTimeout(animationTimerRef.current);
			}
		},
		[],
	);

	useEffect(() => {
		if (
			ensureVisibleIndex == null ||
			ensureVisibleIndex < 0 ||
			ensureVisibleIndex >= data.length
		) {
			return;
		}

		const itemStart = offsets[ensureVisibleIndex] ?? 0;
		const itemEnd = offsets[ensureVisibleIndex + 1] ?? itemStart;
		let nextScrollTop = scrollTop;

		// Move up only when the focused item is above the viewport.
		if (itemStart < scrollTop) {
			nextScrollTop = itemStart;
		}

		// Move down only when the focused item is below the viewport.
		if (itemEnd > scrollTop + height) {
			nextScrollTop = itemEnd - height;
		}

		nextScrollTop = Math.max(0, Math.min(maximumScrollTop, nextScrollTop));
		if (nextScrollTop !== scrollTop) {
			stickToBottomRef.current = nextScrollTop >= maximumScrollTop;
			targetScrollTopRef.current = nextScrollTop;
			updateScrollTop(nextScrollTop);
		}
	}, [
		data.length,
		ensureVisibleIndex,
		height,
		maximumScrollTop,
		offsets,
		scrollTop,
	]);

	useEffect(() => {
		const previousOffsetsValue = previousOffsets.current;
		const grewBy = totalHeight - previousTotalHeight.current;
		previousTotalHeight.current = totalHeight;
		previousOffsets.current = offsets;

		// New streamed content should stay visible only while the user is at
		// the bottom (optionally forced while the active message is
		// bottom-anchored). If the user scrolled up, never yank them down:
		// preserve their position via the anchor-stability branch below.
		if (stickToBottomRef.current && (forceStickToBottom || grewBy !== 0)) {
			targetScrollTopRef.current = maximumScrollTop;
			updateScrollTop(maximumScrollTop);
			return;
		}

		// Anchor stability: when items above the viewport change height
		// (e.g. a tool-call message above is expanded), shift scrollTop by the
		// same delta so the visible content does not jump.
		const previousScrollTop = scrollTopRef.current;
		let previousFirstVisible = 0;
		while (
			previousFirstVisible < data.length - 1 &&
			(previousOffsetsValue[previousFirstVisible + 1] ?? 0) <= previousScrollTop
		) {
			previousFirstVisible++;
		}
		const deltaAbove =
			(offsets[previousFirstVisible] ?? 0) -
			(previousOffsetsValue[previousFirstVisible] ?? 0);
		const next = Math.max(
			0,
			Math.min(maximumScrollTop, previousScrollTop + deltaAbove),
		);
		targetScrollTopRef.current = next;
		updateScrollTop(next);
	}, [maximumScrollTop, totalHeight, offsets, forceStickToBottom, data.length]);

	const firstVisibleIndex = useMemo(() => {
		let index = 0;
		while (index < data.length - 1 && offsets[index + 1] <= scrollTop) {
			index++;
		}
		return index;
	}, [data.length, offsets, scrollTop]);

	const lastVisibleIndex = useMemo(() => {
		let index = firstVisibleIndex;
		const visibleEnd = scrollTop + height;
		while (index < data.length - 1 && offsets[index] < visibleEnd) {
			index++;
		}
		return Math.min(data.length - 1, index);
	}, [data.length, firstVisibleIndex, height, offsets, scrollTop]);

	// Spacers are measured relative to the current viewport. Using the
	// absolute item offset here would push the visible items off-screen after
	// scrolling down because the viewport already starts at `scrollTop`.
	const emptyViewportSpace =
		totalHeight <= height && scrollTop >= maximumScrollTop
			? height - totalHeight
			: 0;
	const topSpacer = Math.max(
		0,
		emptyViewportSpace + (offsets[firstVisibleIndex] ?? 0) - scrollTop,
	);
	const bottomSpacer = Math.max(
		0,
		totalHeight - (offsets[lastVisibleIndex + 1] ?? totalHeight),
	);

	const scrollBy = (delta: number) => {
		const nextTarget = Math.max(
			0,
			Math.min(maximumScrollTop, targetScrollTopRef.current + delta),
		);
		targetScrollTopRef.current = nextTarget;
		stickToBottomRef.current = nextTarget >= maximumScrollTop;
		scheduleScrollAnimation();
	};

	useScroll({
		ref: viewportRef,
		getScrollState: () => ({
			scrollTop,
			scrollHeight: totalHeight,
			innerHeight: height,
		}),
		scrollBy,
		scrollTo: position => {
			const next = Math.max(0, Math.min(maximumScrollTop, position));
			targetScrollTopRef.current = next;
			stickToBottomRef.current = next >= maximumScrollTop;
			updateScrollTop(next);
		},
	});

	if (data.length === 0) {
		return <Box ref={viewportRef} width={width} height={height} />;
	}

	return (
		<Box ref={viewportRef} width={width} height={height} flexDirection="column">
			<Box height={topSpacer} flexShrink={0} />
			{data
				.slice(firstVisibleIndex, lastVisibleIndex + 1)
				.map((item, offset) => {
					const index = firstVisibleIndex + offset;
					const itemStart = offsets[index] ?? 0;
					const itemEnd = offsets[index + 1] ?? itemStart;
					const visibleStart = Math.max(itemStart, scrollTop);
					const visibleEnd = Math.min(itemEnd, scrollTop + height);
					const clipTop = Math.max(0, visibleStart - itemStart);
					const visibleRows = Math.max(1, visibleEnd - visibleStart);
					return (
						// The wrapper clips the item to its visible slice; the
						// negative margin shifts the content up by clipTop so a
						// partly visible item is cut mid-content without
						// breaking the layout.
						<Box
							key={keyExtractor(item, index)}
							height={visibleRows}
							overflow="hidden"
							flexShrink={0}
							flexDirection="column"
						>
							<Box marginTop={-clipTop} flexShrink={0} flexDirection="column">
								{renderItem({
									item,
									index,
									startRow: visibleStart - scrollTop + 1,
									clipTop,
									visibleRows,
								})}
							</Box>
						</Box>
					);
				})}
			<Box height={bottomSpacer} flexShrink={0} />
		</Box>
	);
}
