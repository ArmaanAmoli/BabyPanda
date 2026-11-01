import React from 'react';
import {Box, Text} from 'ink';
import {VirtualizedList} from './VirtualizedList';
import {useViewPortMessage} from '../hooks/useViewPortMessage';
import {useTerminal} from '../hooks/useTerminal';
import {HEIGHT_OF_BOTTOM_CONTENT, PADDING_APP} from '../app';
import {useVisibleMessages} from '../hooks/useVisibleMessages';
import {Role} from '@baby-panda/types';
import {getMessageGroups} from '../utils/messageGroups';

interface ChatRow {
	content: string;
	role: Role;
	messageIndices: number[];
	isSeparator?: boolean;
}

const EMPTY_ROW = '\u00a0';

function getRoleColor(role: Role) {
	if (role === Role.thought) return '#863737';
	if (role === Role.assistant) return '#7e7474';
	if (role === Role.tool) return '#4d3838';
	return '#f6eeee';
}

export function ChatBox() {
	const {viewPortMessages} = useViewPortMessage();
	const {rows, columns} = useTerminal();
	const {focusedMessageIndex} = useVisibleMessages();
	const chatRows = React.useMemo<ChatRow[]>(() => {
		const groups = getMessageGroups(
			viewPortMessages.map(message => ({
				role: message.role,
				content: '',
				createdAt: message.createdAt,
			})),
		);
		return groups.flatMap(messageIndices => {
			const first = viewPortMessages[messageIndices[0]];
			const lines = messageIndices.flatMap(
				index => viewPortMessages[index]?.lines ?? [],
			);
			return [
				...lines.map(line => ({
					content: line.content || EMPTY_ROW,
					role: first.role,
					messageIndices,
				})),
				{
					content: EMPTY_ROW,
					role: first.role,
					messageIndices,
					isSeparator: true,
				},
			];
		});
	}, [viewPortMessages]);

	return (
		<Box flexGrow={1} flexDirection="column" justifyContent="flex-end">
			<VirtualizedList
				data={chatRows}
				height={Math.max(1, rows - HEIGHT_OF_BOTTOM_CONTENT)}
				ensureVisibleIndex={
					focusedMessageIndex == null
						? null
						: chatRows.findIndex(row =>
								row.messageIndices.includes(focusedMessageIndex),
							)
				}
				getItemHeight={() => 1}
				keyExtractor={(_row, index) => String(index)}
				renderItem={({item}) => (
					<Box
						width="100%"
						height={1}
						flexShrink={0}
						flexDirection="row"
						backgroundColor="#111111"
					>
						{item.isSeparator ? (
							<Text color="#404040">
								{'─'.repeat(Math.max(1, columns - 2 * PADDING_APP - 2))}
							</Text>
						) : (
							<>
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
										focusedMessageIndex !== null &&
										item.messageIndices.includes(focusedMessageIndex)
											? '#242424'
											: '#111111'
									}
								>
									<Text wrap="truncate" dimColor={item.role === Role.thought}>
										{item.content}
									</Text>
								</Box>
							</>
						)}
					</Box>
				)}
			/>
		</Box>
	);
}
