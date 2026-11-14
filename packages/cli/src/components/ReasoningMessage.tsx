import React, {useRef, useState} from 'react';
import {Box, Text, type DOMElement} from 'ink';
import type {MessageLine} from '../types';
import {useMouse} from '../hooks/useMouse';
import type {MouseEvent} from '../utils/terminal/mouse';
import {SPINNER_FRAMES, useSpinnerFrame} from './spinner';
import {
	APP_BACKGROUND_COLOR,
	HIGHLIGHT_BACKGROUND,
	REASONING_ACCENT,
} from '../theme';

/** Glyph width plus the space after it: continuation lines align under text. */
const GLYPH_INDENT = 2;

export interface ReasoningMessageProps {
	/** Wrapped content lines of the reasoning block. */
	lines: MessageLine[];
	/** True while the block is still receiving streamed content. */
	streaming: boolean;
	expanded: boolean;
	onToggle: () => void;
	/** First visible terminal row of this item (1-based). */
	startRow: number;
	/** Rows clipped above the viewport. */
	clipTop: number;
	/** Visible rows of this item in the viewport. */
	visibleRows: number;
	width: number;
	focused: boolean;
}

/**
 * One reasoning block as a collapsible bullet.
 *
 * The glyph is the live signal: the shared braille spinner while the block is
 * still streaming, and `∴` once it has settled. That conversion is the only
 * indication that reasoning has finished. Collapsing is never overridden — a
 * block the user folded mid-stream stays folded — and the whole first row is
 * the click target, with `Space` on the focused block for keyboard parity.
 */
export function ReasoningMessage({
	lines,
	streaming,
	expanded,
	onToggle,
	startRow,
	clipTop,
	visibleRows,
	width,
	focused,
}: ReasoningMessageProps) {
	const frame = useSpinnerFrame(streaming);
	const glyph = streaming ? SPINNER_FRAMES[frame]! : '∴';
	const [hovered, setHovered] = useState(false);
	const rootRef = useRef<DOMElement>(null);

	const height = expanded ? Math.max(1, lines.length) : 1;

	useMouse((event: MouseEvent) => {
		if (event.row < startRow || event.row >= startRow + visibleRows) return;
		// the glyph row is the handle, and it is only reachable while the top of
		// the block is actually on screen
		const isGlyphRow = clipTop === 0 && event.row === startRow;
		if (event.name === 'left-press') {
			if (isGlyphRow) onToggle();
		} else if (event.name === 'move') {
			setHovered(isGlyphRow);
		}
	});

	const highlighted = (focused && !expanded) || hovered;
	const lineCount = lines.length;
	const label = `thinking · ${lineCount} line${lineCount === 1 ? '' : 's'}`;

	if (!expanded) {
		return (
			<Box
				ref={rootRef}
				width={width}
				height={1}
				flexShrink={0}
				backgroundColor={
					highlighted ? HIGHLIGHT_BACKGROUND : APP_BACKGROUND_COLOR
				}
			>
				<Text color={REASONING_ACCENT}>{glyph}</Text>
				<Text> </Text>
				<Text dimColor wrap="truncate">
					{label} · click to expand
				</Text>
			</Box>
		);
	}

	return (
		<Box
			ref={rootRef}
			width={width}
			height={height}
			flexShrink={0}
			flexDirection="column"
			backgroundColor={APP_BACKGROUND_COLOR}
		>
			{lines.map((line, index) => (
				<Box
					key={index}
					width={width}
					height={1}
					flexShrink={0}
					flexDirection="row"
					backgroundColor={
						index === 0 && highlighted
							? HIGHLIGHT_BACKGROUND
							: APP_BACKGROUND_COLOR
					}
				>
					{index === 0 ? (
						<>
							<Text color={REASONING_ACCENT}>{glyph}</Text>
							<Text> </Text>
						</>
					) : (
						<Text>{' '.repeat(GLYPH_INDENT)}</Text>
					)}
					<Box flexGrow={1} height={1} overflow="hidden">
						<Text wrap="truncate" dimColor>
							{line.content}
						</Text>
					</Box>
				</Box>
			))}
		</Box>
	);
}
