import React, {useCallback, useEffect, useMemo} from 'react';
import {Box, Text} from 'ink';
import {VirtualizedList} from './VirtualizedList';
import {useViewPortMessage} from '../hooks/useViewPortMessage';
import {useTerminal} from '../hooks/useTerminal';
import {PADDING_APP} from '../layout';
import {useVisibleMessages} from '../hooks/useVisibleMessages';
import {useMessageHistory} from '../hooks/useMessageHistroy';
import {useSettings} from '../hooks/useSettings';
import {useToolCallUi} from '../hooks/useToolCallUi';
import {useReasoningUi} from '../hooks/useReasoningUi';
import {ContentType, Role} from '@baby-panda/types';
import type {MessageLine, ToolCallBatch} from '../types';
import {decodeToolCallBatch} from '../types';
import {buildTranscriptBoxes} from '../utils/responseSlots';
import {buildToolCallLayout} from '../utils/toolCallLayout';
import {ToolCallMessage} from './ToolCallMessage';
import {ReasoningMessage} from './ReasoningMessage';
import {pandaBannerRows} from '../utils/pandaBanner';
import {
	APP_BACKGROUND_COLOR,
	ASSISTANT_GLYPH,
	TEXT_WHITE,
	USER_BAND_BACKGROUND,
} from '../theme';

/** Glyph width plus the space after it: continuation lines align under text. */
const GLYPH_INDENT = 2;

type ChatItem =
	| {kind: 'banner'; rows: string[]}
	| {
			kind: 'text';
			messageIndices: number[];
			role: Role | ContentType;
			lines: MessageLine[];
			user: boolean;
	  }
	| {
			kind: 'reasoning';
			messageIndices: number[];
			key: string;
			lines: MessageLine[];
	  }
	| {
			kind: 'content';
			messageIndices: number[];
			role: Role | ContentType;
			lines: MessageLine[];
	  }
	| {
			kind: 'tool';
			messageIndices: number[];
			key: string;
			batch: ToolCallBatch | null;
	  };

const EMPTY_ROW = ' ';

/** Leading glyph of a plain text message. */
function roleGlyph(role: Role | ContentType): string {
	if (role === Role.user) return '>';
	if (role === Role.skill) return '⚡';
	if (role === Role.tool || role === ContentType.tool_call) return '●';
	return '◆';
}

function roleGlyphColor(role: Role | ContentType): string {
	if (role === Role.user || role === Role.skill) return TEXT_WHITE;
	return ASSISTANT_GLYPH;
}

export function ChatBox({
	height,
	sessionId,
}: {
	height: number;
	sessionId: string;
}) {
	const {viewPortMessages} = useViewPortMessage();
	const {messageHistory} = useMessageHistory();
	const {columns} = useTerminal();
	const {focusedMessageIndex} = useVisibleMessages();
	const settings = useSettings();
	const {
		isGroupExpanded,
		toggleGroup,
		expandedDiffs,
		toggleDiff,
		expandGroup,
		isCommandExpanded,
		toggleCommand,
	} = useToolCallUi();
	const {isReasoningExpanded, toggleReasoning} = useReasoningUi();

	const chatWidth = Math.max(10, columns - 2 * PADDING_APP);

	const bannerRows = useMemo(
		() => pandaBannerRows(sessionId, chatWidth),
		[sessionId, chatWidth],
	);

	// One item per box: the banner, then the transcript boxes in display
	// order. Each item renders exactly one block plus one trailing blank row,
	// so the height cache and the rendered content can never disagree.
	const items = useMemo<ChatItem[]>(() => {
		const linesOf = (indices: number[]): MessageLine[] =>
			indices.flatMap(index => viewPortMessages[index]?.lines ?? []);
		const roleOf = (index: number): Role | ContentType =>
			viewPortMessages[index]?.role ?? ContentType.content;

		return [
			{kind: 'banner' as const, rows: bannerRows},
			...buildTranscriptBoxes(viewPortMessages).map(box => {
				switch (box.kind) {
					case 'user':
						return {
							kind: 'text' as const,
							messageIndices: [box.index],
							role: roleOf(box.index),
							lines: linesOf([box.index]),
							user: true,
						};
					case 'prefix':
						return {
							kind: 'text' as const,
							messageIndices: [box.index],
							role: roleOf(box.index),
							lines: linesOf([box.index]),
							user: false,
						};
					case 'reasoning':
						return {
							kind: 'reasoning' as const,
							messageIndices: box.indices,
							key: `reasoning-${box.indices[0] ?? 0}`,
							lines: linesOf(box.indices),
						};
					case 'content':
						return {
							kind: 'content' as const,
							messageIndices: box.indices,
							role: roleOf(box.indices[0]!),
							lines: linesOf(box.indices),
						};
					case 'tool':
						return {
							kind: 'tool' as const,
							messageIndices: [box.index],
							key: `tool-${box.index}`,
							batch: decodeToolCallBatch(
								messageHistory[box.index]?.content ?? '',
							),
						};
				}
			}),
		];
	}, [viewPortMessages, messageHistory, bannerRows]);

	const isDiffExpanded = useCallback(
		(callId: string) => expandedDiffs[callId] === true,
		[expandedDiffs],
	);

	// Height cache: keyed by the items, the expand state and the terminal
	// size, so it is invalidated exactly when content, expanded/collapsed
	// state, or width changes. Every item adds one blank separator row.
	const itemHeights = useMemo(
		() =>
			items.map(item => {
				if (item.kind === 'banner') return item.rows.length + 1;
				if (item.kind === 'reasoning') {
					return (
						(isReasoningExpanded(item.key)
							? Math.max(1, item.lines.length)
							: 1) + 1
					);
				}
				if (item.kind === 'tool') {
					// an undecodable batch still costs its separator row
					if (item.batch == null) return 2;
					return (
						buildToolCallLayout(item.batch, {
							expanded: isGroupExpanded(item.batch.id),
							isDiffExpanded,
							isCommandExpanded,
							chatHeight: height,
							width: chatWidth,
						}).height + 1
					);
				}
				return Math.max(1, item.lines.length) + 1;
			}),
		[
			items,
			isGroupExpanded,
			isDiffExpanded,
			isCommandExpanded,
			isReasoningExpanded,
			height,
			chatWidth,
		],
	);

	const getItemHeight = useCallback(
		(_item: ChatItem, index: number) => itemHeights[index] ?? 1,
		[itemHeights],
	);

	const responding = settings.responding.responding;

	// The latest reasoning block spins until the whole run finishes: any box
	// can receive data at any time, so the run — not the block — is the
	// streaming unit. Past iterations keep their settled marker.
	const streamingReasoningKey = useMemo(() => {
		if (!responding) return null;
		for (let index = items.length - 1; index >= 0; index--) {
			const item = items[index]!;
			if (item.kind === 'reasoning') return item.key;
		}
		return null;
	}, [items, responding]);

	// the latest tool-call batch auto-expands while the agent is responding
	const activeToolBatch = useMemo(() => {
		if (!responding) return null;
		for (let index = items.length - 1; index >= 0; index--) {
			const item = items[index]!;
			if (item.kind === 'tool') return item.batch;
		}
		return null;
	}, [items, responding]);

	useEffect(() => {
		if (activeToolBatch) {
			expandGroup(activeToolBatch.id);
		}
	}, [activeToolBatch, expandGroup]);

	return (
		<Box flexGrow={1} flexDirection="column" justifyContent="flex-end">
			<VirtualizedList
				data={items}
				height={height}
				forceStickToBottom={activeToolBatch != null}
				ensureVisibleIndex={
					focusedMessageIndex == null
						? null
						: items.findIndex(
								item =>
									item.kind !== 'banner' &&
									item.messageIndices.includes(focusedMessageIndex),
							)
				}
				getItemHeight={getItemHeight}
				keyExtractor={(item, index) =>
					item.kind === 'banner'
						? 'banner'
						: item.kind === 'reasoning'
							? item.key
							: item.kind === 'tool'
								? item.key
								: `text-${item.messageIndices[0] ?? index}`
				}
				renderItem={({item, startRow, clipTop, visibleRows}) => {
					const itemFocused =
						focusedMessageIndex !== null &&
						item.kind !== 'banner' &&
						item.messageIndices.includes(focusedMessageIndex);

					if (item.kind === 'banner') {
						return (
							<>
								{item.rows.map((row, rowIndex) => (
									<Text key={rowIndex}>{row}</Text>
								))}
								<Box height={1} flexShrink={0} />
							</>
						);
					}

					if (item.kind === 'reasoning') {
						return (
							<>
								<ReasoningMessage
									lines={item.lines}
									streaming={streamingReasoningKey === item.key}
									expanded={isReasoningExpanded(item.key)}
									onToggle={() => toggleReasoning(item.key)}
									startRow={startRow}
									clipTop={clipTop}
									visibleRows={visibleRows}
									width={chatWidth}
									focused={itemFocused}
								/>
								<Box height={1} flexShrink={0} />
							</>
						);
					}

					if (item.kind === 'tool') {
						return (
							<>
								{/* an undecodable batch renders nothing rather than throwing */}
								{item.batch == null ? (
									<Box height={1} flexShrink={0} />
								) : (
									<ToolCallMessage
										batch={item.batch}
										expanded={isGroupExpanded(item.batch.id)}
										onToggleGroup={() => toggleGroup(item.batch!.id)}
										isDiffExpanded={isDiffExpanded}
										onToggleDiff={toggleDiff}
										isCommandExpanded={isCommandExpanded}
										onToggleCommand={toggleCommand}
										startRow={startRow}
										clipTop={clipTop}
										visibleRows={visibleRows}
										chatHeight={height}
										width={chatWidth}
										focused={itemFocused}
									/>
								)}
								<Box height={1} flexShrink={0} />
							</>
						);
					}

					if (item.kind === 'text' || item.kind === 'content') {
						return (
							<GlyphBlock
								role={item.role}
								lines={item.lines}
								user={item.kind === 'text' && item.user}
							/>
						);
					}

					return <></>;
				}}
			/>
		</Box>
	);
}

/**
 * A plain text message: glyph on the first row, wrapped continuation lines
 * indenting to align under the text, and a full-width band behind user
 * messages.
 */
function GlyphBlock({
	role,
	lines,
	user,
}: {
	role: Role | ContentType;
	lines: MessageLine[];
	user: boolean;
}) {
	return (
		<>
			{lines.map((line, lineIndex) => (
				<Box
					key={lineIndex}
					width="100%"
					height={1}
					flexShrink={0}
					flexDirection="row"
					backgroundColor={user ? USER_BAND_BACKGROUND : APP_BACKGROUND_COLOR}
				>
					{/* The glyph marks the first row only; wrapped lines
					    indent to align under the text. */}
					{lineIndex === 0 ? (
						<>
							<Text color={roleGlyphColor(role)}>{roleGlyph(role)}</Text>
							<Text> </Text>
						</>
					) : (
						<Text>{' '.repeat(GLYPH_INDENT)}</Text>
					)}
					<Box flexGrow={1} height={1} overflow="hidden">
						<Text wrap="truncate">{line.content || EMPTY_ROW}</Text>
					</Box>
				</Box>
			))}
			<Box height={1} flexShrink={0} />
		</>
	);
}
