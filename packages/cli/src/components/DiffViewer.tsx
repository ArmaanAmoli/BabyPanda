import React, {useEffect, useRef, useState} from 'react';
import {Box, Text, type DOMElement} from 'ink';
import type {ToolCallEntry} from '../types';
import {
	DIFF_CONTEXT_LINES,
	type DiffRow,
	type UnifiedDiff,
} from '../utils/diffRows';
import {maxDiffHeight} from '../utils/toolCallLayout';
import {useScroll} from '../hooks/useScroll';
import {
	APP_BACKGROUND_COLOR,
	DIFF_ADDED_BACKGROUND,
	DIFF_ADDED_TEXT,
	DIFF_REMOVED_BACKGROUND,
	DIFF_REMOVED_TEXT,
} from '../theme';

const LINE_NO_WIDTH = 4;

/** Diff line text and the line-number gutter. */
const DIFF_TEXT = '#FFFFFF';
const LINE_NO_COLOR = '#B5B5B5';

function rowColor(type: string): string | undefined {
	if (type === 'removed') return DIFF_REMOVED_TEXT;
	if (type === 'added') return DIFF_ADDED_TEXT;
	return undefined;
}

function rowBackground(type: string): string | undefined {
	if (type === 'removed') return DIFF_REMOVED_BACKGROUND;
	if (type === 'added') return DIFF_ADDED_BACKGROUND;
	return undefined;
}

function lineNumber(value: number | null): string {
	return value == null
		? ' '.repeat(LINE_NO_WIDTH)
		: String(value).padStart(LINE_NO_WIDTH, ' ');
}

function DiffLineView({row, width}: {row: DiffRow; width: number}) {
	if (row.kind === 'gap') {
		return (
			<Box width={width} height={1} flexShrink={0}>
				<Text color="#6b6060" wrap="truncate">
					{' '.repeat(LINE_NO_WIDTH * 2 + 3)}⋮ {row.hidden} unchanged line
					{row.hidden === 1 ? '' : 's'}
				</Text>
			</Box>
		);
	}

	const prefix =
		row.type === 'added' ? '+' : row.type === 'removed' ? '−' : ' ';
	return (
		<Box
			width={width}
			height={1}
			flexShrink={0}
			backgroundColor={rowBackground(row.type) ?? APP_BACKGROUND_COLOR}
		>
			<Text color={LINE_NO_COLOR} wrap="truncate">
				{lineNumber(row.oldNo)} {lineNumber(row.newNo)}{' '}
			</Text>
			<Text wrap="truncate" color={rowColor(row.type)}>
				{prefix}
			</Text>
			<Text wrap="truncate" color={DIFF_TEXT}>
				{row.text}
			</Text>
		</Box>
	);
}

export interface DiffViewerProps {
	call: ToolCallEntry;
	/** Precomputed diff rows (shared with the layout/height calculation). */
	diff: UnifiedDiff;
	expanded: boolean;
	width: number;
	chatHeight: number;
}

/**
 * Vertical, GitHub-style diff for one write/edit call: a dim dual line-number
 * gutter, a coloured +/− prefix, and the line text, with changed rows tinted
 * full width. `diff.rows` already contains only the changed hunks plus a few
 * context lines (unchanged runs are collapsed into gap rows), so the whole
 * file is never shown. Collapsed to a one-line header; expanded shows the
 * rows capped at maxDiffHeight(chatHeight) with internal wheel scrolling on
 * hover, initially scrolled to the first changed hunk.
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

	// start at the first changed hunk whenever the viewer is expanded
	useEffect(() => {
		if (expanded) {
			setScrollTop(
				Math.max(
					0,
					Math.min(maxScrollTop, diff.firstChangeIndex - DIFF_CONTEXT_LINES),
				),
			);
		}
	}, [expanded, diff.firstChangeIndex, maxScrollTop]);

	const path =
		typeof call.arguments['path'] === 'string'
			? (call.arguments['path'] as string)
			: '';

	return (
		<Box flexDirection="column" flexShrink={0} width={width}>
			<Box height={1} flexShrink={0}>
				<Text color="#8a7f7f" wrap="truncate">
					{'  '}± {path} <Text color={DIFF_ADDED_TEXT}>+{diff.added}</Text>{' '}
					<Text color={DIFF_REMOVED_TEXT}>−{diff.removed}</Text>
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
							<DiffLineView key={index} row={row} width={width} />
						))}
					</Box>
				</Box>
			)}
		</Box>
	);
}
