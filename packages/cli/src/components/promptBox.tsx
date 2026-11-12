import React from 'react';
import {Box, Text, useInput} from 'ink';
import {useTerminal} from '../hooks/useTerminal';
import {APP_BACKGROUND_COLOR} from '../theme';
import {useMouse} from '../hooks/useMouse';
import type {MouseEvent} from '../utils/terminal/mouse';
import {wrapText, type VisualLine} from '../utils/promptLayout';

export interface PromptBoxArgs {
	placeholder: string;
	value: string;
	onSubmit: () => void;
	onChange: (value: string) => void;
	active?: boolean;
	start?: number;
	end?: number;
	maxHeight?: number;
	/** When a slash menu is open it owns up/down/enter; the input only filters. */
	menuOpen?: boolean;
}

function getCursorLine(lines: VisualLine[], cursor: number) {
	const lineIndex = lines.findIndex(
		(line, index) =>
			cursor < line.end ||
			(cursor === line.end &&
				(index === lines.length - 1 || lines[index + 1]?.start !== cursor)),
	);
	return lineIndex === -1 ? lines.length - 1 : lineIndex;
}

function getPreviousCharacterOffset(value: string, offset: number) {
	const characters = Array.from(value.slice(0, offset));
	return offset - (characters.at(-1)?.length ?? 0);
}

function getNextCharacterOffset(value: string, offset: number) {
	return offset + (Array.from(value.slice(offset))[0]?.length ?? 0);
}

function PromptInput({
	value,
	placeholder,
	onChange,
	onSubmit,
	width,
	maxLines,
	start,
	end,
	menuOpen,
}: {
	value: string;
	placeholder: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	width: number;
	maxLines: number;
	start: number;
	end: number;
	menuOpen: boolean;
}) {
	const [cursor, setCursor] = React.useState(value.length);
	const [scrollTop, setScrollTop] = React.useState(0);
	const lines = React.useMemo(() => wrapText(value, width), [value, width]);
	const cursorLine = getCursorLine(lines, cursor);
	const maxScrollTop = Math.max(0, lines.length - maxLines);
	const visibleStart = Math.min(
		maxScrollTop,
		Math.max(0, Math.max(scrollTop, cursorLine - maxLines + 1)),
	);
	const visibleLines = lines.slice(visibleStart, visibleStart + maxLines);

	useMouse((event: MouseEvent) => {
		if (event.row < start || event.row > end) return;

		if (event.name === 'scroll-up') {
			setScrollTop(current => Math.max(0, current - 1));
		} else if (event.name === 'scroll-down') {
			setScrollTop(current => Math.min(maxScrollTop, current + 1));
		}
	});

	React.useEffect(() => {
		setCursor(current => Math.min(current, value.length));
	}, [value.length]);

	React.useEffect(() => {
		setScrollTop(current => {
			let next = current;
			if (cursorLine < current) {
				next = cursorLine;
			} else if (cursorLine >= current + maxLines) {
				next = cursorLine - maxLines + 1;
			}
			return Math.min(maxScrollTop, Math.max(0, next));
		});
	}, [cursorLine, maxLines, maxScrollTop]);

	useInput((input, key) => {
		if (key.tab || (key.shift && key.tab)) return;
		// while the slash menu is open, navigation/submit keys belong to the menu
		if (menuOpen && (key.return || key.upArrow || key.downArrow)) return;
		if (key.return) {
			onSubmit();
			return;
		}

		const currentLine = lines[cursorLine] ?? {
			start: 0,
			end: 0,
			text: '',
			displayWidth: 0,
		};
		const column = cursor - currentLine.start;
		let nextCursor = cursor;
		let nextValue = value;

		if (key.upArrow || key.downArrow) {
			const targetLine = lines[cursorLine + (key.upArrow ? -1 : 1)];
			if (targetLine) {
				const targetCharacters = Array.from(targetLine.text);
				const targetColumn = targetCharacters
					.slice(0, column)
					.reduce((total, character) => total + character.length, 0);
				nextCursor = Math.min(targetLine.start + targetColumn, targetLine.end);
			}
		} else if (key.leftArrow) {
			nextCursor = getPreviousCharacterOffset(value, cursor);
		} else if (key.rightArrow) {
			nextCursor = Math.min(
				value.length,
				getNextCharacterOffset(value, cursor),
			);
		} else if (key.backspace) {
			if (cursor > 0) {
				const previousCharacter =
					Array.from(value.slice(0, cursor)).pop() ?? '';
				nextCursor = cursor - previousCharacter.length;
				nextValue = value.slice(0, nextCursor) + value.slice(cursor);
			}
		} else if (key.delete) {
			const nextCharacter = Array.from(value.slice(cursor))[0] ?? '';
			if (nextCharacter) {
				nextValue =
					value.slice(0, cursor) + value.slice(cursor + nextCharacter.length);
			}
		} else if (input) {
			nextValue = value.slice(0, cursor) + input + value.slice(cursor);
			nextCursor += input.length;
		}

		setCursor(nextCursor);
		if (nextValue !== value) onChange(nextValue);
	});

	if (value.length === 0) {
		return <Text dimColor>{placeholder}</Text>;
	}

	return (
		<Box
			flexDirection="column"
			width={width}
			height={maxLines}
			overflow="hidden"
		>
			{visibleLines.map(line => {
				const cursorInLine =
					cursor >= line.start &&
					cursor <= line.end &&
					(cursor < line.end || line.end === value.length);
				const localCursor = Math.max(
					0,
					Math.min(line.text.length, cursor - line.start),
				);
				const lineCharacters = Array.from(line.text);
				let cursorCharacterIndex = 0;
				let characterOffset = 0;
				while (
					cursorCharacterIndex < lineCharacters.length &&
					characterOffset < localCursor
				) {
					characterOffset += lineCharacters[cursorCharacterIndex].length;
					cursorCharacterIndex++;
				}
				const cursorCharacter = lineCharacters[cursorCharacterIndex];
				const beforeCursor = lineCharacters
					.slice(0, cursorCharacterIndex)
					.join('');
				const afterCursor = lineCharacters
					.slice(cursorCharacterIndex + (cursorInLine ? 1 : 0))
					.join('');

				return (
					<Box
						key={`${line.start}-${line.end}`}
						width={width}
						height={1}
						overflow="hidden"
					>
						{cursorInLine ? (
							<Text>
								{beforeCursor}
								<Text inverse color="#9fe3bd">
									{cursorCharacter ?? ' '}
								</Text>
								{afterCursor}
							</Text>
						) : (
							<Text>{line.text}</Text>
						)}
					</Box>
				);
			})}
		</Box>
	);
}

export function InlineInput({
	value,
	placeholder,
	onChange,
	onSubmit,
}: {
	value: string;
	placeholder: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
}) {
	useInput((input, key) => {
		if (key.return) {
			onSubmit();
		} else if (key.backspace) {
			onChange(value.slice(0, -1));
		} else if (!key.delete && input) {
			onChange(value + input);
		}
	});

	return value ? <Text>{value}</Text> : <Text dimColor>{placeholder}</Text>;
}

export default function PromptBox({
	placeholder,
	value,
	onChange,
	onSubmit,
	active = true,
	start,
	end,
	maxHeight = 8,
	menuOpen = false,
}: PromptBoxArgs) {
	const terminal = useTerminal();
	const width = Math.max(10, terminal.columns - 5);
	const inputHeight = Math.max(1, maxHeight - 2);

	return (
		<Box
			flexDirection="column"
			width="100%"
			height={maxHeight}
			backgroundColor={APP_BACKGROUND_COLOR}
		>
			<Text color="#555555">{'─'.repeat(width)}</Text>
			{active ? (
				<PromptInput
					value={value}
					placeholder={placeholder}
					onChange={onChange}
					onSubmit={onSubmit}
					width={width}
					maxLines={inputHeight}
					start={start ?? terminal.rows - 3}
					end={end ?? terminal.rows}
					menuOpen={menuOpen}
				/>
			) : (
				<Text dimColor>{placeholder}</Text>
			)}
			<Text color="#555555">{'─'.repeat(width)}</Text>
		</Box>
	);
}
