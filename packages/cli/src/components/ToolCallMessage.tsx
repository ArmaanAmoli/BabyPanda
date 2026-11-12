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
	rowSpanAtLine,
	COLLAPSED_MAX_BULLETS,
	COMMAND_INDENT,
} from '../utils/toolCallLayout';
import {
	bulletTargetMax,
	BULLET_PADDING_LEFT,
	statusIcon,
	type BulletView,
} from '../utils/toolCallBullets';
import {
	linkDisplayText,
	osc8Link,
	supportsOsc8Hyperlinks,
	truncateEnd,
} from '../utils/formatLink';
import {DiffViewer} from './DiffViewer';
import {APP_BACKGROUND_COLOR} from '../theme';

const TOOL_COLOR = '#4d3838';
export const MARKER_WIDTH = 1;
const ROW_PADDING_LEFT = 1;

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

function BulletRow({
	bullet,
	width,
	highlighted,
}: {
	bullet: BulletView;
	width: number;
	highlighted: boolean;
}) {
	const icon = statusIcon(bullet.status);
	const iconColor =
		bullet.status === 'done'
			? '#9fe3bd'
			: bullet.status === 'failed'
				? '#f08a8a'
				: '#8a7f7f';
	const stats = bullet.stats ?? '';
	const verb = `${bullet.verb} `;
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
			width={width}
			height={1}
			flexShrink={0}
			paddingLeft={BULLET_PADDING_LEFT}
			overflow="hidden"
			backgroundColor={highlighted ? '#242424' : APP_BACKGROUND_COLOR}
		>
			<Text color={iconColor}>{icon}</Text>
			<Text> </Text>
			<Text color="#c9bebe">{'  '}</Text>
			<Text color="#e8dede" wrap="truncate">
				{verb}
			</Text>
			<Text color="#9fb4c7" wrap="truncate">
				{targetText}
			</Text>
			{stats.length > 0 && <Text color="#8a7f7f"> {stats}</Text>}
		</Box>
	);
}

/**
 * One assistant message's tool calls as a stateful chat block. Collapsed to a
 * fixed height (min(5, content)); click (or Space when focused) expands it.
 * Bullets are status icon + verb + target + stats; write/edit calls also get a
 * collapsible DiffViewer each. Wheel over the expanded block scrolls its
 * internal content; clicks use the item's actual visible row range.
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
	const contentWidth = Math.max(10, width - MARKER_WIDTH);
	const layout = useMemo(
		() =>
			buildToolCallLayout(batch, {
				expanded,
				isDiffExpanded,
				isCommandExpanded,
				chatHeight,
				width: contentWidth,
			}),
		[
			batch,
			expanded,
			isDiffExpanded,
			isCommandExpanded,
			chatHeight,
			contentWidth,
		],
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
			const row = spanAt(logicalRow)?.row;
			if (!row) return;
			if (row.type === 'bullet') {
				if (row.bullet.hasDiff) {
					onToggleDiff(row.bullet.diffCallIds[0]!);
					// a collapsed group renders no diff rows, so reveal them
					if (!expanded) onToggleGroup();
				} else if (row.bullet.expandable) {
					// shell command: reveal the part cut off by the '…' below
					// the bullet (expanding the group too if it is collapsed)
					onToggleCommand(row.bullet.key);
					if (!expanded) onToggleGroup();
				} else {
					onToggleGroup();
				}
			} else if (row.type === 'diff') {
				onToggleDiff(row.call.id);
			} else if (row.type === 'command') {
				onToggleCommand(row.bullet.key);
			} else {
				onToggleGroup();
			}
		} else if (event.name === 'move') {
			const span = spanAt(logicalRow);
			setHoveredRow(span?.row.type === 'bullet' ? span.index : null);
		}
	});

	const callCount = batch.calls.length;
	// only offer "click to collapse" when expanding actually added rows
	const canCollapse = layout.expandedFullHeight > layout.collapsedHeight;
	const headerText = `⚒ ${callCount} tool call${callCount === 1 ? '' : 's'}${
		expanded && canCollapse ? ' · click to collapse' : ''
	}`;

	const renderRow = (row: LayoutRow, index: number) => {
		const rowHighlighted = (focused && !expanded) || hoveredRow === index;
		switch (row.type) {
			case 'header':
				return (
					<Box
						key={index}
						height={1}
						flexShrink={0}
						paddingLeft={ROW_PADDING_LEFT}
						overflow="hidden"
						backgroundColor={focused ? '#242424' : APP_BACKGROUND_COLOR}
					>
						<Text color="#8a7f7f" wrap="truncate">
							{headerText}
						</Text>
					</Box>
				);
			case 'bullet':
				return (
					<Box key={index} height={1} flexShrink={0}>
						<BulletRow
							bullet={row.bullet}
							width={contentWidth}
							highlighted={rowHighlighted}
						/>
					</Box>
				);
			case 'error':
				return (
					<Box
						key={index}
						height={1}
						flexShrink={0}
						paddingLeft={ROW_PADDING_LEFT + 4}
						overflow="hidden"
					>
						<Text color="#f08a8a" wrap="truncate">
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
						paddingLeft={COMMAND_INDENT}
						overflow="hidden"
					>
						<Text color="#9fb4c7" wrap="truncate">
							{row.line}
						</Text>
					</Box>
				);
			case 'diff':
				return (
					<Box key={index} flexShrink={0} paddingLeft={ROW_PADDING_LEFT + 2}>
						<DiffViewer
							call={row.call}
							diff={row.diff}
							expanded={isDiffExpanded(row.call.id)}
							width={contentWidth - 2}
							chatHeight={chatHeight}
						/>
					</Box>
				);
			case 'overflowHint':
				return (
					<Box
						key={index}
						height={1}
						flexShrink={0}
						paddingLeft={ROW_PADDING_LEFT + 2}
						overflow="hidden"
					>
						<Text color="#6b6060" wrap="truncate">
							… {layout.bullets.length - COLLAPSED_MAX_BULLETS} more · click to
							expand
						</Text>
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
				{layout.rows.map((row, index) => (
					<Box key={index} flexDirection="row" flexShrink={0}>
						<Box
							width={MARKER_WIDTH}
							height={row.type === 'diff' ? undefined : 1}
							flexShrink={0}
						>
							<Text color={TOOL_COLOR}>▏</Text>
						</Box>
						<Box flexGrow={1} flexShrink={0} flexDirection="column">
							{renderRow(row, index)}
						</Box>
					</Box>
				))}
			</Box>
		</Box>
	);
}
