import React, {useMemo, useRef, useState} from 'react';
import {Box, Text, type DOMElement} from 'ink';
import type {ToolCallBatch} from '../types';
import {useMouse} from '../hooks/useMouse';
import {useScroll} from '../hooks/useScroll';
import type {MouseEvent} from '../utils/terminal/mouse';
import {
	buildToolCallLayout,
	type LayoutRow,
	type LayoutRowSpan,
	resolveRowClick,
	rowSpanAtLine,
	COMMAND_GAP,
} from '../utils/toolCallLayout';
import {
	bulletTargetMax,
	statusColor,
	type BulletView,
} from '../utils/toolCallBullets';
import {
	linkDisplayText,
	osc8Link,
	supportsOsc8Hyperlinks,
	truncateEnd,
} from '../utils/formatLink';
import {DiffViewer} from './DiffViewer';
import {APP_BACKGROUND_COLOR, HIGHLIGHT_BACKGROUND, TEXT_WHITE} from '../theme';

/** Muted grey for secondary text: hints, command continuation, error detail. */
const MUTED_TEXT = '#8a7f7f';

export interface ToolCallMessageProps {
	batch: ToolCallBatch;
	expanded: boolean;
	onToggleGroup: () => void;
	isDiffExpanded: (callId: string) => boolean;
	onToggleDiff: (callId: string) => void;
	isCommandExpanded: (bulletKey: string) => boolean;
	onToggleCommand: (bulletKey: string) => void;
	/** First visible terminal row of this item (1-based). */
	startRow: number;
	/** Rows clipped above the viewport. */
	clipTop: number;
	/** Visible rows of this item in the viewport. */
	visibleRows: number;
	chatHeight: number;
	width: number;
	focused: boolean;
}

/**
 * One assistant message's tool calls as a bullet block.
 *
 * A batch of several calls renders a square `■ N tools` root that folds the
 * whole batch; a batch of one flattens to a lone `●`. Each bullet is a
 * status-coloured dot plus a white verb and a dim target, and clicking it
 * expands that call's own diff, command or error. Status lives entirely in
 * the dot's colour, so red and green never appear in the text.
 */
export function ToolCallMessage({
	batch,
	expanded,
	onToggleGroup,
	isDiffExpanded,
	onToggleDiff,
	isCommandExpanded,
	onToggleCommand,
	startRow,
	clipTop,
	visibleRows,
	chatHeight,
	width,
	focused,
}: ToolCallMessageProps) {
	const layout = useMemo(
		() =>
			buildToolCallLayout(batch, {
				expanded,
				isDiffExpanded,
				isCommandExpanded,
				chatHeight,
				width,
			}),
		[batch, expanded, isDiffExpanded, isCommandExpanded, chatHeight, width],
	);
	const height = layout.height;
	const maxGroupScroll = Math.max(0, layout.expandedFullHeight - height);
	const [groupScrollTop, setGroupScrollTop] = useState(0);
	const [hoveredRow, setHoveredRow] = useState<number | null>(null);
	const rootRef = useRef<DOMElement>(null);

	useScroll(
		{
			ref: rootRef,
			getScrollState: () => ({
				scrollTop: groupScrollTop,
				scrollHeight: layout.expandedFullHeight,
				innerHeight: height,
			}),
			scrollBy: delta => {
				setGroupScrollTop(current =>
					Math.max(0, Math.min(maxGroupScroll, current + delta)),
				);
			},
		},
		expanded && maxGroupScroll > 0,
	);

	const spanAt = (line: number): LayoutRowSpan | undefined =>
		rowSpanAtLine(layout.rowSpans, line);

	useMouse((event: MouseEvent) => {
		if (event.row < startRow || event.row >= startRow + visibleRows) return;
		// map the terminal row to a content line of the (possibly internally
		// scrolled) content, then to the row that occupies that line
		const logicalRow = clipTop + (event.row - startRow) + groupScrollTop;
		if (event.name === 'left-press') {
			const span = spanAt(logicalRow);
			const action = resolveRowClick(span, logicalRow, layout.hasRoot);
			switch (action.type) {
				case 'toggleGroup':
					onToggleGroup();
					return;
				case 'toggleDiff':
					onToggleDiff(action.callId);
					break;
				case 'toggleCommand':
					onToggleCommand(action.key);
					break;
				case 'ignore':
					return;
			}
			// A collapsed group renders no diff or command rows, so a click
			// that asks for one has to reveal them first.
			if (!expanded) onToggleGroup();
		} else if (event.name === 'move') {
			const span = spanAt(logicalRow);
			setHoveredRow(
				span?.row.type === 'bullet' || span?.row.type === 'root'
					? span.index
					: null,
			);
		}
	});

	// Collapsing a rooted batch always hides its bullets, so the hint follows
	// hasRoot. expandedFullHeight is 0 while collapsed, so comparing it to
	// collapsedHeight here would keep the hint hidden exactly when it applies.
	const canExpand = layout.hasRoot;

	const renderRoot = (
		row: Extract<LayoutRow, {type: 'root'}>,
		index: number,
	) => {
		const highlighted = (focused && !expanded) || hoveredRow === index;
		return (
			<Box
				key={index}
				height={1}
				flexShrink={0}
				overflow="hidden"
				backgroundColor={
					highlighted ? HIGHLIGHT_BACKGROUND : APP_BACKGROUND_COLOR
				}
			>
				<Text color={statusColor(row.status)}>■</Text>
				<Text> </Text>
				<Text color={TEXT_WHITE} wrap="truncate">
					{row.callCount} tool{row.callCount === 1 ? '' : 's'}
				</Text>
				{!expanded && canExpand && (
					<Text color={MUTED_TEXT}> · click to expand</Text>
				)}
			</Box>
		);
	};

	const renderBullet = (
		bullet: BulletView,
		index: number,
		highlighted: boolean,
	) => {
		const targetMax = bulletTargetMax(bullet, width);
		let targetText: string;
		if (bullet.link) {
			const display = linkDisplayText(bullet.link, targetMax);
			targetText = supportsOsc8Hyperlinks()
				? osc8Link(bullet.link, display)
				: display;
		} else {
			targetText = truncateEnd(bullet.target, targetMax);
		}

		return (
			<Box
				key={index}
				width={width}
				height={1}
				flexShrink={0}
				paddingLeft={bullet.indent}
				overflow="hidden"
				backgroundColor={
					highlighted ? HIGHLIGHT_BACKGROUND : APP_BACKGROUND_COLOR
				}
			>
				<Text color={statusColor(bullet.status)}>●</Text>
				<Text> </Text>
				<Text color={TEXT_WHITE} wrap="truncate">
					{bullet.verb}
				</Text>
				<Text> </Text>
				<Text> </Text>
				<Text dimColor wrap="truncate">
					{targetText}
				</Text>
				{bullet.stats !== undefined && bullet.stats.length > 0 && (
					<Text dimColor> {bullet.stats}</Text>
				)}
			</Box>
		);
	};

	const renderRow = (row: LayoutRow, index: number) => {
		const rowHighlighted = (focused && !expanded) || hoveredRow === index;
		switch (row.type) {
			case 'root':
				return renderRoot(row, index);
			case 'bullet':
				return renderBullet(row.bullet, index, rowHighlighted);
			case 'error':
				return (
					<Box
						key={index}
						height={1}
						flexShrink={0}
						paddingLeft={row.bullet.indent + 2}
						overflow="hidden"
					>
						<Text color={TEXT_WHITE} wrap="truncate">
							{row.bullet.error ?? 'failed'}
						</Text>
					</Box>
				);
			case 'command':
				// continuation of an expanded shell command: wrapped to the
				// content width so it never crosses the message boundary
				return (
					<Box
						key={index}
						height={1}
						flexShrink={0}
						paddingLeft={row.bullet.indent + COMMAND_GAP}
						overflow="hidden"
					>
						<Text dimColor wrap="truncate">
							{row.line}
						</Text>
					</Box>
				);
			case 'diff':
				return (
					<Box key={index} flexShrink={0} paddingLeft={row.indent}>
						<DiffViewer
							call={row.call}
							diff={row.diff}
							expanded={isDiffExpanded(row.call.id)}
							width={width - row.indent}
							chatHeight={chatHeight}
						/>
					</Box>
				);
		}
	};

	return (
		<Box
			ref={rootRef}
			height={height}
			overflow="hidden"
			flexShrink={0}
			flexDirection="column"
			width={width}
			backgroundColor={APP_BACKGROUND_COLOR}
		>
			<Box marginTop={-groupScrollTop} flexShrink={0} flexDirection="column">
				{layout.rows.map((row, index) => renderRow(row, index))}
			</Box>
		</Box>
	);
}
