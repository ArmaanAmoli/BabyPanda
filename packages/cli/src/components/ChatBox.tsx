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
import {getMessageGroups} from '../utils/messageGroups';
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
	| {kind: 'tool'; messageIndices: number[]; batch: ToolCallBatch | null}
	| {
			kind: 'reasoning';
			messageIndices: number[];
			lines: MessageLine[];
			key: string;
	  }
	| {
			kind: 'text';
			messageIndices: number[];
			role: Role | ContentType;
			lines: MessageLine[];
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

	const messageItems = useMemo<ChatItem[]>(() => {
		const groups = getMessageGroups(
			viewPortMessages.map(message => ({
				role: message.role,
				content: '',
				createdAt: message.createdAt,
			})),
		);
		return groups.map(messageIndices => {
			const first = viewPortMessages[messageIndices[0]]!;
			if (first.role === ContentType.tool_call) {
				const content = messageHistory[messageIndices[0]]?.content ?? '';
				return {
					kind: 'tool' as const,
					messageIndices,
					batch: decodeToolCallBatch(content),
				};
			}
			const lines = messageIndices.flatMap(
				index => viewPortMessages[index]?.lines ?? [],
			);
			if (first.role === ContentType.reasoning_content) {
				return {
					kind: 'reasoning' as const,
					messageIndices,
					lines,
					key: `reasoning-${messageIndices[0]}`,
				};
			}
			return {
				kind: 'text' as const,
				messageIndices,
				role: first.role,
				lines,
			};
		});
	}, [viewPortMessages, messageHistory]);

	// The banner is the first item of the list, so it scrolls up with the
	// transcript instead of being erased the moment history is non-empty.
	const items = useMemo<ChatItem[]>(
		() => [{kind: 'banner' as const, rows: bannerRows}, ...messageItems],
		[bannerRows, messageItems],
	);

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
				if (item.kind === 'tool') {
					// an undecodable batch still costs its separator row
					if (item.batch == null) return 2;
					const layout = buildToolCallLayout(item.batch, {
						expanded: isGroupExpanded(item.batch.id),
						isDiffExpanded,
						isCommandExpanded,
						chatHeight: height,
						width: chatWidth,
					});
					return layout.height + 1;
				}
				if (item.kind === 'reasoning') {
					const content = isReasoningExpanded(item.key)
						? Math.max(1, item.lines.length)
						: 1;
					return content + 1;
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
	const lastItem = items.at(-1);
	const activeToolBatch =
		responding && lastItem?.kind === 'tool' && lastItem.batch != null
			? lastItem.batch
			: null;

	// the latest tool-call block auto-expands while the agent is responding
	useEffect(() => {
		if (activeToolBatch) {
			expandGroup(activeToolBatch.id);
		}
	}, [activeToolBatch, expandGroup]);

	// A reasoning block is streaming while the agent is responding and it is
	// still the last thing in the transcript; once the answer starts it is not.
	const streamingReasoningKey =
		responding && lastItem?.kind === 'reasoning' ? lastItem.key : null;

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
						: item.kind === 'tool' && item.batch
							? `tool-${item.batch.id}`
							: item.kind === 'reasoning'
								? `reasoning-${item.key}`
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

					if (item.kind === 'tool') {
						// an undecodable batch renders nothing rather than throwing
						if (item.batch == null) return <Box height={1} flexShrink={0} />;
						const batch = item.batch;
						return (
							<>
								<ToolCallMessage
									batch={batch}
									expanded={isGroupExpanded(batch.id)}
									onToggleGroup={() => toggleGroup(batch.id)}
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

					if (item.kind !== 'text') return <></>;

					const isUser = item.role === Role.user;
					return (
						<>
							{item.lines.map((line, lineIndex) => (
								<Box
									key={lineIndex}
									width="100%"
									height={1}
									flexShrink={0}
									flexDirection="row"
									backgroundColor={
										isUser ? USER_BAND_BACKGROUND : APP_BACKGROUND_COLOR
									}
								>
									{/* The glyph marks the first row only; wrapped lines
									    indent to align under the text. */}
									{lineIndex === 0 ? (
										<>
											<Text color={roleGlyphColor(item.role)}>
												{roleGlyph(item.role)}
											</Text>
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
				}}
			/>
		</Box>
	);
}
