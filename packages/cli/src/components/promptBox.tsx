import React from 'react';
import {Box, Text, useInput, type DOMElement} from 'ink';
import {useTerminal} from '../hooks/useTerminal';
import {APP_BACKGROUND_COLOR} from '../theme';
import {useScroll} from '../hooks/useScroll';
import {PADDING_APP} from '../layout';
import {
	SCROLLBAR_WIDTH,
	getColumnAtOffset,
	getOffsetAtColumn,
	getWrappedLineCount,
	wrapPromptValue,
	type PromptVisualLine,
} from '../utils/promptLayout';
import {
	applyPaste,
	getPasteRangeAfter,
	getPasteRangeBefore,
	isEmptyPrompt,
	promptText,
	replaceRange,
	textValue,
	type PromptValue,
} from '../utils/promptValue';

const CURSOR_COLOR = '#9fe3bd';
const RULE_COLOR = '#555555';
const SCROLLBAR_TRACK = '│';
const SCROLLBAR_THUMB = '┃';

/** Undo depth. Far more than a prompt box needs, and it costs nothing. */
const UNDO_LIMIT = 100;

/**
 * A paste becomes a chip only when it would occupy more than this many rows.
 * Below it a chip costs a row to save none, so the text is inserted as typed.
 */
const PASTE_COLLAPSE_ROW_THRESHOLD = 2;

export interface PromptBoxArgs {
	placeholder: string;
	value: PromptValue;
	onSubmit: () => void;
	onChange: (value: PromptValue) => void;
	active?: boolean;
	maxHeight?: number;
	/** When a slash menu is open it owns up/down/enter; the input only filters. */
	menuOpen?: boolean;
}

interface Snapshot {
	value: PromptValue;
	cursor: number;
}

function getCursorLine(lines: PromptVisualLine[], cursor: number) {
	const lineIndex = lines.findIndex(
		(line, index) =>
			cursor < line.end ||
			(cursor === line.end &&
				(index === lines.length - 1 || lines[index + 1]?.start !== cursor)),
	);
	return lineIndex === -1 ? lines.length - 1 : lineIndex;
}

/** UTF-16 length of the character ending at `offset`. */
function getPreviousCharacterLength(text: string, offset: number): number {
	const characters = Array.from(text.slice(0, offset));
	return characters.at(-1)?.length ?? 0;
}

/** UTF-16 length of the character starting at `offset`. */
function getNextCharacterLength(text: string, offset: number): number {
	return Array.from(text.slice(offset))[0]?.length ?? 0;
}

/** Offset where the word ending at `offset` begins. */
function getWordStart(text: string, offset: number): number {
	let position = offset;
	while (position > 0 && /\s/.test(text[position - 1]!)) position--;
	while (position > 0 && !/\s/.test(text[position - 1]!)) position--;
	return position;
}

/**
 * A chunk is a paste when it is longer than one character or contains a
 * newline. The Kitty keyboard protocol is enabled, so every real keypress
 * arrives in its own chunk and a multi-character chunk cannot have been typed.
 * The rule is also safe when it is wrong: the collapse threshold needs more
 * than two visual rows, so two keystrokes coalescing into one read, or a
 * key-repeat burst, both land under it and insert as plain text.
 */
function isPaste(input: string): boolean {
	return input.length > 1 || input.includes('\n') || input.includes('\r');
}

/** Dim track, accent thumb. */
function getScrollbarColor(cell: string): string {
	return cell === SCROLLBAR_THUMB ? CURSOR_COLOR : RULE_COLOR;
}

function buildScrollbar(
	scrollTop: number,
	contentHeight: number,
	viewportHeight: number,
): string[] {
	if (contentHeight <= viewportHeight) {
		return Array.from({length: viewportHeight}, () => ' ');
	}

	const thumbSize = Math.max(
		1,
		Math.floor((viewportHeight * viewportHeight) / contentHeight),
	);
	const maximumThumbTop = viewportHeight - thumbSize;
	const scrollable = contentHeight - viewportHeight;
	const thumbTop =
		maximumThumbTop <= 0 || scrollable <= 0
			? 0
			: Math.round((scrollTop * maximumThumbTop) / scrollable);

	const cells: string[] = [];
	for (let row = 0; row < viewportHeight; row++) {
		cells.push(
			row >= thumbTop && row < thumbTop + thumbSize
				? SCROLLBAR_THUMB
				: SCROLLBAR_TRACK,
		);
	}

	return cells;
}

function PromptInput({
	value,
	placeholder,
	onChange,
	onSubmit,
	width,
	maxLines,
	menuOpen,
	active,
}: {
	value: PromptValue;
	placeholder: string;
	onChange: (value: PromptValue) => void;
	onSubmit: () => void;
	width: number;
	maxLines: number;
	menuOpen: boolean;
	active: boolean;
}) {
	const text = promptText(value);
	const wrapWidth = Math.max(1, width - SCROLLBAR_WIDTH);

	const [cursor, setCursor] = React.useState(text.length);
	const [scrollTop, setScrollTop] = React.useState(0);
	const [undoStack, setUndoStack] = React.useState<Snapshot[]>([]);
	const [redoStack, setRedoStack] = React.useState<Snapshot[]>([]);

	// Id of the chip created by the immediately preceding paste. Cleared by any
	// other edit, which is what makes "paste the same content again" mean
	// "expand the chip I just made" rather than "expand some older chip".
	const lastPasteIdRef = React.useRef<string | null>(null);
	// The value we last pushed up, so an externally set value (submit, a slash
	// completion) can be told apart from our own edit and reset the cursor.
	const lastPushedRef = React.useRef(value);
	const viewportRef = React.useRef<DOMElement>(null);

	const lines = React.useMemo(
		() => wrapPromptValue(value, wrapWidth),
		[value, wrapWidth],
	);
	const cursorLine = getCursorLine(lines, cursor);
	const maximumScrollTop = Math.max(0, lines.length - maxLines);
	const visibleStart = Math.min(scrollTop, maximumScrollTop);
	const visibleLines = lines.slice(visibleStart, visibleStart + maxLines);

	const scrollBy = React.useCallback(
		(delta: number) => {
			setScrollTop(current =>
				Math.max(0, Math.min(maximumScrollTop, current + delta)),
			);
		},
		[maximumScrollTop],
	);

	const scrollTo = React.useCallback(
		(position: number) => {
			setScrollTop(Math.max(0, Math.min(maximumScrollTop, position)));
		},
		[maximumScrollTop],
	);

	useScroll({
		ref: viewportRef,
		getScrollState: () => ({
			scrollTop,
			scrollHeight: lines.length,
			innerHeight: maxLines,
		}),
		scrollBy,
		scrollTo,
		hasFocus: () => active,
	});

	// Keep the cursor on screen, and keep the offset inside the content. This
	// only re-runs when the cursor line or the viewport size changes, so a wheel
	// scroll that leaves the cursor off screen stays exactly where the user put
	// it until the cursor moves again.
	React.useEffect(() => {
		setScrollTop(current => {
			let next = Math.min(current, maximumScrollTop);
			if (cursorLine < next) {
				next = cursorLine;
			} else if (cursorLine >= next + maxLines) {
				next = cursorLine - maxLines + 1;
			}

			return Math.max(0, Math.min(maximumScrollTop, next));
		});
	}, [cursorLine, maxLines, maximumScrollTop]);

	React.useEffect(() => {
		if (value === lastPushedRef.current) return;

		lastPushedRef.current = value;
		lastPasteIdRef.current = null;
		setCursor(promptText(value).length);
		setScrollTop(0);
		setUndoStack([]);
		setRedoStack([]);
	}, [value]);

	const commit = React.useCallback(
		(nextValue: PromptValue, nextCursor: number, nextPasteId?: string) => {
			const flattened = promptText(nextValue);
			const boundedCursor = Math.max(0, Math.min(nextCursor, flattened.length));

			if (nextValue !== value) {
				setUndoStack(stack => [...stack, {value, cursor}].slice(-UNDO_LIMIT));
				setRedoStack([]);
			}

			lastPushedRef.current = nextValue;
			lastPasteIdRef.current = nextPasteId ?? null;
			setCursor(boundedCursor);
			onChange(nextValue);
		},
		[cursor, onChange, value],
	);

	const restore = React.useCallback(
		(snapshot: Snapshot) => {
			lastPushedRef.current = snapshot.value;
			lastPasteIdRef.current = null;
			setCursor(
				Math.max(
					0,
					Math.min(snapshot.cursor, promptText(snapshot.value).length),
				),
			);
			onChange(snapshot.value);
		},
		[onChange],
	);

	const undo = React.useCallback(() => {
		const previous = undoStack.at(-1);
		if (!previous) return;

		setUndoStack(stack => stack.slice(0, -1));
		setRedoStack(stack => [...stack, {value, cursor}].slice(-UNDO_LIMIT));
		restore(previous);
	}, [cursor, restore, undoStack]);

	const redo = React.useCallback(() => {
		const next = redoStack.at(-1);
		if (!next) return;

		setRedoStack(stack => stack.slice(0, -1));
		setUndoStack(stack => [...stack, {value, cursor}].slice(-UNDO_LIMIT));
		restore(next);
	}, [cursor, restore, redoStack, value]);

	/**
	 * A collapsed chip is atomic, so the cursor must never come to rest inside
	 * one. Arriving from the left snaps to the chip's start, from the right to
	 * its end. An expanded paste is ordinary text and is left alone.
	 */
	const keepCursorOutOfChips = (offset: number, direction: -1 | 1) => {
		let position = 0;

		for (const segment of value.segments) {
			const segmentEnd = position + segment.text.length;

			if (
				segment.kind === 'paste' &&
				segment.collapsed &&
				offset > position &&
				offset < segmentEnd
			) {
				return direction === -1 ? position : segmentEnd;
			}

			position = segmentEnd;
		}

		return offset;
	};

	const moveCursorVertically = (direction: -1 | 1) => {
		const targetLine = lines[cursorLine + direction];
		if (!targetLine) return;

		const currentLine = lines[cursorLine]!;
		const column = getColumnAtOffset(
			currentLine.text,
			cursor - currentLine.start,
		);
		const targetOffset = getOffsetAtColumn(targetLine.text, column);
		const target = Math.min(targetLine.start + targetOffset, targetLine.end);
		setCursor(keepCursorOutOfChips(target, direction));
	};

	const moveCursorBy = (direction: -1 | 1) => {
		setCursor(current => {
			const next =
				direction === -1
					? Math.max(0, current - getPreviousCharacterLength(text, current))
					: Math.min(
							text.length,
							current + getNextCharacterLength(text, current),
						);

			return keepCursorOutOfChips(next, direction);
		});
	};

	const deleteBackward = () => {
		const chip = getPasteRangeBefore(value, cursor);
		if (chip) {
			commit(replaceRange(value, chip.start, chip.end, null), chip.start);
			return;
		}

		if (cursor === 0) return;

		const length = getPreviousCharacterLength(text, cursor);
		commit(replaceRange(value, cursor - length, cursor, null), cursor - length);
	};

	const deleteForward = () => {
		const chip = getPasteRangeAfter(value, cursor);
		if (chip) {
			commit(replaceRange(value, chip.start, chip.end, null), chip.start);
			return;
		}

		const length = getNextCharacterLength(text, cursor);
		if (length === 0) return;

		commit(replaceRange(value, cursor, cursor + length, null), cursor);
	};

	const deleteToLineStart = () => {
		const line = lines[cursorLine];
		if (!line || cursor === line.start) return;

		commit(replaceRange(value, line.start, cursor, null), line.start);
	};

	const deleteToLineEnd = () => {
		const line = lines[cursorLine];
		if (!line || cursor === line.end) return;

		commit(replaceRange(value, cursor, line.end, null), cursor);
	};

	const deleteWordBackward = () => {
		const start = getWordStart(text, cursor);
		if (start === cursor) return;

		commit(replaceRange(value, start, cursor, null), start);
	};

	const insertText = (inserted: string) => {
		// A carriage return reaching this point is a terminal oddity rather than
		// something the user typed. Left alone it would be rendered mid-line and
		// carriage-return the terminal, which is what originally mangled the
		// display, so it is normalised to a newline here as a last line of
		// defence (pastes are already normalised by the stdin filter).
		const text = inserted.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
		if (text.length === 0) return;

		commit(
			replaceRange(value, cursor, cursor, {kind: 'text', text}),
			cursor + text.length,
		);
	};

	const insertNewline = () => {
		commit(
			replaceRange(value, cursor, cursor, {kind: 'text', text: '\n'}),
			cursor + 1,
		);
	};

	const paste = (pasted: string) => {
		// Terminals send CR or CRLF for newlines inside a pasted block. The stdin
		// filter normalises them when bracketed paste is active, but a terminal
		// without it delivers the raw bytes here, and a carriage return left in
		// the value is what originally mangled the display.
		const text = pasted.replaceAll('\r\n', '\n').replaceAll('\r', '\n');

		// A short paste is not worth a chip: it would cost a row to save none.
		if (getWrappedLineCount(text, wrapWidth) <= PASTE_COLLAPSE_ROW_THRESHOLD) {
			insertText(text);
			return;
		}

		const result = applyPaste(value, cursor, text, lastPasteIdRef.current);
		commit(result.value, cursor + text.length, result.pasteId ?? undefined);
	};

	useInput(
		(input, key) => {
			// Focus switching and blurring belong to the app-level handler.
			if (key.tab || key.escape) return;

			// While the slash menu is open it owns submit and vertical navigation.
			if (menuOpen && (key.return || key.upArrow || key.downArrow)) return;

			// Enter arrives as a carriage return on every terminal, but some
			// send CRLF. A CRLF must submit rather than be inserted as literal
			// text: a stray carriage return in the value is what originally
			// mangled the prompt box's display.
			if (input === '\r\n') {
				onSubmit();
				return;
			}

			// A lone line feed is Ctrl+J, the newline key that works without the
			// Kitty keyboard protocol. Terminals lacking that protocol send
			// Shift+Enter as a bare carriage return, making it indistinguishable
			// from Enter, and many terminals swallow Alt+Enter as a window
			// shortcut before it ever reaches us. This must be handled before the
			// paste check below, which would otherwise read it as a one-character
			// paste.
			if (input === '\n') {
				insertNewline();
				return;
			}

			if (key.return) {
				if (key.shift || key.meta) {
					insertNewline();
				} else {
					onSubmit();
				}

				return;
			}

			if (key.upArrow) {
				moveCursorVertically(-1);
				return;
			}

			if (key.downArrow) {
				moveCursorVertically(1);
				return;
			}

			if (key.leftArrow) {
				moveCursorBy(-1);
				return;
			}

			if (key.rightArrow) {
				moveCursorBy(1);
				return;
			}

			if (key.backspace) {
				deleteBackward();
				return;
			}

			if (key.delete) {
				deleteForward();
				return;
			}

			if (key.pageUp) {
				scrollBy(-(maxLines - 1));
				return;
			}

			if (key.pageDown) {
				scrollBy(maxLines - 1);
				return;
			}

			if (key.home) {
				setCursor(0);
				scrollTo(0);
				return;
			}

			if (key.end) {
				setCursor(text.length);
				scrollTo(maximumScrollTop);
				return;
			}

			if (key.ctrl) {
				if (input === 'u') {
					deleteToLineStart();
				} else if (input === 'k') {
					deleteToLineEnd();
				} else if (input === 'w') {
					deleteWordBackward();
				} else if (input === 'z') {
					undo();
				} else if (input === 'y') {
					redo();
				} else if (input === 'l') {
					commit(textValue(''), 0);
				}

				// Every other control combination is somebody else's.
				return;
			}

			// A bare meta keypress is a terminal shortcut, not prompt text.
			if (key.meta) return;

			if (isPaste(input)) {
				paste(input);
				return;
			}

			if (input) {
				insertText(input);
			}
		},
		{isActive: active},
	);

	if (isEmptyPrompt(value)) {
		return (
			<Box ref={viewportRef} width={width} height={maxLines} flexShrink={0}>
				<Text dimColor>{placeholder}</Text>
			</Box>
		);
	}

	const scrollbar = buildScrollbar(scrollTop, lines.length, maxLines);

	return (
		<Box
			ref={viewportRef}
			flexDirection="column"
			width={width}
			height={maxLines}
			flexShrink={0}
		>
			{visibleLines.map((line, index) => {
				const cursorInLine =
					cursor >= line.start &&
					cursor <= line.end &&
					(cursor < line.end || line.end === text.length);

				return (
					<Box
						key={`${line.segmentIndex}-${line.start}-${line.end}`}
						flexDirection="row"
						width={width}
						height={1}
						flexShrink={0}
					>
						<Box width={wrapWidth} height={1} flexShrink={0} overflow="hidden">
							{line.isChip ? (
								<Text>
									{cursor === line.start && (
										<Text inverse color={CURSOR_COLOR}>
											{' '}
										</Text>
									)}
									<Text color={CURSOR_COLOR}>[</Text>
									<Text dimColor>
										{line.text.length >= 2 ? line.text.slice(1, -1) : ''}
									</Text>
									<Text color={CURSOR_COLOR}>]</Text>
									{cursor === line.end && (
										<Text inverse color={CURSOR_COLOR}>
											{' '}
										</Text>
									)}
								</Text>
							) : cursorInLine ? (
								<Text>{renderLineWithCursor(line, cursor)}</Text>
							) : (
								<Text>{line.text}</Text>
							)}
						</Box>
						<Box width={SCROLLBAR_WIDTH} height={1} flexShrink={0}>
							<Text color={getScrollbarColor(scrollbar[index] ?? ' ')}>
								{scrollbar[index] ?? ' '}
							</Text>
						</Box>
					</Box>
				);
			})}
		</Box>
	);
}

/**
 * Splits a visual line at the cursor so the character under it can be drawn in
 * inverse video. Offsets are UTF-16, so surrogate pairs stay intact.
 */
function renderLineWithCursor(
	line: PromptVisualLine,
	cursor: number,
): React.ReactNode {
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
		characterOffset += lineCharacters[cursorCharacterIndex]!.length;
		cursorCharacterIndex++;
	}

	const cursorCharacter = lineCharacters[cursorCharacterIndex];
	const beforeCursor = lineCharacters.slice(0, cursorCharacterIndex).join('');
	const afterCursor = lineCharacters.slice(cursorCharacterIndex + 1).join('');

	return (
		<>
			{beforeCursor}
			<Text inverse color={CURSOR_COLOR}>
				{cursorCharacter ?? ' '}
			</Text>
			{afterCursor}
		</>
	);
}

export function InlineInput({
	value,
	placeholder,
	onChange,
	onSubmit,
	isActive = true,
}: {
	value: string;
	placeholder: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	isActive?: boolean;
}) {
	useInput(
		(input, key) => {
			if (key.return) {
				onSubmit();
			} else if (key.backspace) {
				onChange(value.slice(0, -1));
			} else if (!key.delete && input) {
				onChange(value + input);
			}
		},
		{isActive},
	);

	return value ? <Text>{value}</Text> : <Text dimColor>{placeholder}</Text>;
}

export default function PromptBox({
	placeholder,
	value,
	onChange,
	onSubmit,
	active = true,
	maxHeight = 8,
	menuOpen = false,
}: PromptBoxArgs) {
	const terminal = useTerminal();
	const width = Math.max(10, terminal.columns - 2 * PADDING_APP - 1);
	const inputHeight = Math.max(1, maxHeight - 2);

	return (
		<Box
			flexDirection="column"
			width="100%"
			height={maxHeight}
			backgroundColor={APP_BACKGROUND_COLOR}
		>
			<Text color={RULE_COLOR}>{'─'.repeat(width)}</Text>
			{active ? (
				<PromptInput
					value={value}
					placeholder={placeholder}
					onChange={onChange}
					onSubmit={onSubmit}
					width={width}
					maxLines={inputHeight}
					menuOpen={menuOpen}
					active={active}
				/>
			) : (
				<Text dimColor>{placeholder}</Text>
			)}
			<Text color={RULE_COLOR}>{'─'.repeat(width)}</Text>
		</Box>
	);
}
