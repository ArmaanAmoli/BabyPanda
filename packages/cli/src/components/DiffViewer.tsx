import React, {useEffect, useRef, useState} from 'react';
import {Box, Text, type DOMElement} from 'ink';
import {
	DIFF_CONTEXT_LINES,
	type DiffRow,
	type UnifiedDiff,
} from '../utils/diffRows';
import {diffHeight} from '../utils/toolCallLayout';
import {useScroll} from '../hooks/useScroll';
import {
	DIFF_ADDED_BACKGROUND,
	DIFF_ADDED_TEXT,
	DIFF_REMOVED_BACKGROUND,
	DIFF_REMOVED_TEXT,
} from '../theme';

const LINE_NO_WIDTH = 4;
const TAB_REPLACEMENT = '    ';

/**
 * Make one source line safe for Ink's character grid. Ink measures a tab as
 * zero columns while terminals advance it to a tab stop, which lets the real
 * output wrap over neighbouring rows. Other C0 controls can similarly move
 * the cursor or inject escape sequences, so render a visible replacement.
 */
function terminalSafeLine(text: string): string {
	return [...text.replaceAll('\t', TAB_REPLACEMENT)]
		.map(character => {
			const code = character.charCodeAt(0);
			return code <= 0x1f || code === 0x7f ? '�' : character;
		})
		.join('');
}

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
			backgroundColor={rowBackground(row.type)}
		>
			{/* One text node is measured and truncated as a unit. Separate flex
			    children let a long source line squeeze the gutter out of view. */}
			<Text wrap="truncate">
				<Text color={LINE_NO_COLOR}>
					{lineNumber(row.oldNo)} {lineNumber(row.newNo)}{' '}
				</Text>
				<Text color={rowColor(row.type)}>{prefix}</Text>
				<Text color={DIFF_TEXT}>{terminalSafeLine(row.text)}</Text>
			</Text>
		</Box>
	);
}

export interface DiffViewerProps {
	/** Precomputed diff rows (shared with the layout/height calculation). */
	diff: UnifiedDiff;
	expanded: boolean;
	width: number;
	chatHeight: number;
	/** Viewer rows clipped above the visible window (used by ToolCallMessage). */
	clipTop?: number;
	/** Viewer rows visible in the window; defaults to the full viewer height. */
	visibleRows?: number;
}

/**
 * Vertical, GitHub-style diff for one write/edit call: a dim dual line-number
 * gutter, a coloured +/− prefix, and the line text, with changed rows tinted
 * full width. `diff.rows` already contains only the changed hunks plus a few
 * context lines (unchanged runs are collapsed into gap rows), so the whole
 * file is never shown. Only expanded diff rows render here; the grey tool
 * bullet exclusively owns the path, counts, and expand/collapse interaction.
 * The body is capped at maxDiffHeight(chatHeight) with internal wheel
 * scrolling on hover, initially scrolled to the first changed hunk.
 */
export function DiffViewer({
	diff,
	expanded,
	width,
	chatHeight,
	clipTop = 0,
	visibleRows,
}: DiffViewerProps) {
	const fullHeight = diffHeight(diff, expanded, chatHeight);
	const bodyHeight = expanded ? fullHeight : 0;
	const maxScrollTop = Math.max(0, diff.rows.length - bodyHeight);
	const [scrollTop, setScrollTop] = useState(0);
	const bodyRef = useRef<DOMElement>(null);

	useScroll(
		{
			ref: bodyRef,
			getScrollState: () => ({
				scrollTop,
				scrollHeight: diff.rows.length,
				innerHeight: bodyHeight,
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

	// Render only the visible source-row slice: Ink applies just the innermost
	// overflow clip, so a scrolled/capped viewer must not depend on an
	// ancestor's clip to hide the rest of its rows.
	const clipStart = Math.max(0, Math.min(clipTop, fullHeight));
	const clipEnd = Math.max(
		clipStart,
		Math.min(clipTop + (visibleRows ?? fullHeight), fullHeight),
	);
	const visibleBodyRows = expanded ? Math.max(0, clipEnd - clipStart) : 0;
	const bodyOffset = clipStart;
	const bodyRows = diff.rows.slice(
		scrollTop + bodyOffset,
		scrollTop + bodyOffset + visibleBodyRows,
	);

	return (
		<Box flexDirection="column" flexShrink={0} width={width}>
			{visibleBodyRows > 0 && (
				<Box
					ref={bodyRef}
					height={visibleBodyRows}
					flexShrink={0}
					flexDirection="column"
				>
					{bodyRows.map((row, index) => (
						<DiffLineView
							key={scrollTop + bodyOffset + index}
							row={row}
							width={width}
						/>
					))}
				</Box>
			)}
		</Box>
	);
}
