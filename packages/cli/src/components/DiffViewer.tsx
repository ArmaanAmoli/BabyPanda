import React, {useEffect, useRef, useState} from 'react';
import {Box, Text, type DOMElement} from 'ink';
import type {ToolCallEntry} from '../types';
import type {SideBySideDiff} from '../utils/diffRows';
import {maxDiffHeight} from '../utils/toolCallLayout';
import {useScroll} from '../hooks/useScroll';

const LINE_NO_WIDTH = 4;
const GUTTER = 1;

function cellColor(type: string): string | undefined {
	if (type === 'removed') return '#f08a8a';
	if (type === 'added') return '#9fe3bd';
	return undefined;
}

function cellBackground(type: string): string | undefined {
	if (type === 'removed') return '#4a2323';
	if (type === 'added') return '#1f3a2a';
	return undefined;
}

function SideCellView({
	cell,
	width,
}: {
	cell: SideBySideDiff['rows'][number]['left'];
	width: number;
}) {
	const lineNo =
		cell.lineNo == null
			? ' '.repeat(LINE_NO_WIDTH)
			: String(cell.lineNo).padStart(LINE_NO_WIDTH, ' ');
	const textWidth = Math.max(1, width - LINE_NO_WIDTH - 1);
	return (
		<Box width={width} height={1} flexShrink={0}>
			<Text dimColor wrap="truncate">
				{lineNo}{' '}
			</Text>
			<Text
				wrap="truncate"
				color={cellColor(cell.type)}
				backgroundColor={cellBackground(cell.type)}
				dimColor={cell.type === 'same'}
			>
				{cell.text.slice(0, textWidth)}
			</Text>
		</Box>
	);
}

export interface DiffViewerProps {
	call: ToolCallEntry;
	/** Precomputed diff rows (shared with the layout/height calculation). */
	diff: SideBySideDiff;
	expanded: boolean;
	width: number;
	chatHeight: number;
}

/**
 * Side-by-side diff for one write/edit call: left = file before, right =
 * file after. Collapsed to a one-line header; expanded shows the paired rows
 * capped at maxDiffHeight(chatHeight) with internal wheel scrolling on hover,
 * initially scrolled to the first changed line.
 */
export function DiffViewer({
	call,
	diff,
	expanded,
	width,
	chatHeight,
}: DiffViewerProps) {
	const bodyCap = maxDiffHeight(chatHeight) - 1;
	const visibleRows = expanded
		? Math.max(1, Math.min(diff.rows.length, bodyCap))
		: 0;
	const maxScrollTop = Math.max(0, diff.rows.length - visibleRows);
	const [scrollTop, setScrollTop] = useState(0);
	const bodyRef = useRef<DOMElement>(null);

	useScroll(
		{
			ref: bodyRef,
			getScrollState: () => ({
				scrollTop,
				scrollHeight: diff.rows.length,
				innerHeight: visibleRows,
			}),
			scrollBy: delta => {
				setScrollTop(current =>
					Math.max(0, Math.min(maxScrollTop, current + delta)),
				);
			},
			scrollTo: position => {
				setScrollTop(Math.max(0, Math.min(maxScrollTop, position)));
			},
		},
		expanded,
	);

	// start at the first changed line whenever the viewer is expanded
	useEffect(() => {
		if (expanded) {
			setScrollTop(Math.max(0, Math.min(maxScrollTop, diff.firstChangeIndex)));
		}
	}, [expanded, diff.firstChangeIndex, maxScrollTop]);

	const path =
		typeof call.arguments['path'] === 'string'
			? (call.arguments['path'] as string)
			: '';
	const halfWidth = Math.max(10, Math.floor((width - GUTTER) / 2));

	return (
		<Box flexDirection="column" flexShrink={0} width={width}>
			<Box height={1} flexShrink={0}>
				<Text color="#8a7f7f" wrap="truncate">
					{'  '}± {path} <Text color="#9fe3bd">+{diff.added}</Text>{' '}
					<Text color="#f08a8a">−{diff.removed}</Text>
				</Text>
			</Box>
			{expanded && (
				<Box
					ref={bodyRef}
					height={visibleRows}
					overflow="hidden"
					flexShrink={0}
					flexDirection="column"
				>
					<Box marginTop={-scrollTop} flexShrink={0} flexDirection="column">
						{diff.rows.map((row, index) => (
							<Box key={index} height={1} flexShrink={0} flexDirection="row">
								<SideCellView cell={row.left} width={halfWidth} />
								<Text color="#3a3232">│</Text>
								<SideCellView cell={row.right} width={halfWidth} />
							</Box>
						))}
					</Box>
				</Box>
			)}
		</Box>
	);
}
