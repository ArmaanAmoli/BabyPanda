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
import {ContentType, Role} from '@baby-panda/types';
import type {MessageLine, ToolCallBatch} from '../types';
import {decodeToolCallBatch} from '../types';
import {getMessageGroups} from '../utils/messageGroups';
import {buildToolCallLayout} from '../utils/toolCallLayout';
import {MARKER_WIDTH, ToolCallMessage} from './ToolCallMessage';
import {APP_BACKGROUND_COLOR} from '../theme';

interface ChatItem {
	messageIndices: number[];
	role: Role | ContentType;
	/** Text rows of the group (empty for tool-call groups). */
	lines: MessageLine[];
	/** Decoded batch for tool-call groups. */
	batch: ToolCallBatch | null;
}

const EMPTY_ROW = ' ';

function getRoleColor(role: Role | ContentType) {
	if (role === ContentType.reasoning_content) return '#863737';
	if (role === Role.assistant) return '#7e7474';
	if (role === Role.tool || role === ContentType.tool_call) return '#4d3838';
	if (role === Role.skill) return '#9fe3bd';
	return '#f6eeee';
}

export function ChatBox({height}: {height: number}) {
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

	const chatWidth = Math.max(10, columns - 2 * PADDING_APP);

	const items = useMemo<ChatItem[]>(() => {
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
					messageIndices,
					role: first.role,
					lines: [],
					batch: decodeToolCallBatch(content),
				};
			}
			const lines = messageIndices.flatMap(
				index => viewPortMessages[index]?.lines ?? [],
			);
			return {messageIndices, role: first.role, lines, batch: null};
		});
	}, [viewPortMessages, messageHistory]);

	const isDiffExpanded = useCallback(
		(callId: string) => expandedDiffs[callId] === true,
		[expandedDiffs],
	);

	// Height cache: keyed by the items, the expand state and the terminal
	// size, so it is invalidated exactly when content, expanded/collapsed
	// state, or width changes. Each item adds one separator row.
	const itemHeights = useMemo(
		() =>
			items.map(item => {
				if (item.batch) {
					const layout = buildToolCallLayout(item.batch, {
						expanded: isGroupExpanded(item.batch.id),
						isDiffExpanded,
						isCommandExpanded,
						chatHeight: height,
						width: Math.max(10, chatWidth - MARKER_WIDTH),
					});
					return layout.height + 1;
				}
				return item.lines.length + 1;
			}),
		[
			items,
			isGroupExpanded,
			isDiffExpanded,
			isCommandExpanded,
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
		responding && lastItem?.batch != null ? lastItem.batch : null;

	// the latest tool-call block auto-expands while the agent is responding
	useEffect(() => {
		if (activeToolBatch) {
			expandGroup(activeToolBatch.id);
		}
	}, [activeToolBatch, expandGroup]);

	const separator = (
		<Text color="#404040">{'─'.repeat(Math.max(1, chatWidth - 2))}</Text>
	);

	return (
		<Box flexGrow={1} flexDirection="column" justifyContent="flex-end">
			<VirtualizedList
				data={items}
				height={height}
				forceStickToBottom={activeToolBatch != null}
				ensureVisibleIndex={
					focusedMessageIndex == null
						? null
						: items.findIndex(item =>
								item.messageIndices.includes(focusedMessageIndex),
							)
				}
				getItemHeight={getItemHeight}
				keyExtractor={(item, index) =>
					item.batch
						? `tool-${item.batch.id}`
						: `text-${item.messageIndices[0] ?? index}`
				}
				renderItem={({item, startRow, clipTop, visibleRows}) => {
					const itemFocused =
						focusedMessageIndex !== null &&
						item.messageIndices.includes(focusedMessageIndex);
					if (item.batch) {
						const batch = item.batch;
						return (
							<React.Fragment>
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
								{separator}
							</React.Fragment>
						);
					}
					return (
						<React.Fragment>
							{item.lines.map((line, lineIndex) => (
								<Box
									key={lineIndex}
									width="100%"
									height={1}
									flexShrink={0}
									flexDirection="row"
									backgroundColor={APP_BACKGROUND_COLOR}
								>
									{/* Each terminal row gets the role marker, so the marker
									    remains visible when scrolling through part of a message. */}
									<Box width={1} height={1} flexShrink={0}>
										<Text color={getRoleColor(item.role)}>▏</Text>
									</Box>
									<Box
										flexGrow={1}
										height={1}
										paddingLeft={1}
										backgroundColor={
											itemFocused ? '#242424' : APP_BACKGROUND_COLOR
										}
									>
										<Text
											wrap="truncate"
											dimColor={item.role === ContentType.reasoning_content}
										>
											{line.content || EMPTY_ROW}
										</Text>
									</Box>
								</Box>
							))}
							{separator}
						</React.Fragment>
					);
				}}
			/>
		</Box>
	);
}
