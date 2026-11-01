import {CleanedMessage, Role} from '@baby-panda/types';
import wcwidth from 'ts-wcwidth';

export interface MessageLine {
	role: Role;
	content: string;
	isFirstLine: boolean;
	createdAt: number | null;
	lineLength: number;
	isIncomplete?: boolean;
}
export function breakMessageIntoLines(
	message: CleanedMessage,
	maxWidth: number,
): MessageLine[] {
	const {content, role, createdAt} = message;
	const wrappedContent = Bun.markdown.ansi(content, {columns: maxWidth});
	// const wrappedContent = content;
	const result: MessageLine[] = [];
	let lineLengthBuffer = 0;
	let lineBuffer: string = '';
	let isFirstLine = true;
	let index = 0;
	while (index < wrappedContent.length) {
		// A newline ends the current line; it must not become part of the next
		// one or re-joining the lines would inject blank rows.
		if (wrappedContent[index] === '\n') {
			result.push({
				content: lineBuffer,
				role,
				createdAt,
				isFirstLine,
				lineLength: lineLengthBuffer,
			});
			if (isFirstLine) isFirstLine = false;
			lineBuffer = '';
			lineLengthBuffer = 0;
			index++;
			continue;
		}

		// ANSI escape sequences (colors/styles emitted by Bun.markdown.ansi)
		// occupy zero terminal columns. Appending them without counting keeps
		// the width budget equal to the visible width, so lines wrap at the
		// real box width instead of breaking ~half early.
		if (wrappedContent.charCodeAt(index) === 27) {
			// ESC [ <params> <letter>
			let end = index + 1;
			if (wrappedContent[end] === '[') {
				end++;
				while (
					end < wrappedContent.length &&
					((wrappedContent[end] >= '0' && wrappedContent[end] <= '9') ||
						wrappedContent[end] === ';')
				) {
					end++;
				}
				if (
					end < wrappedContent.length &&
					((wrappedContent[end] >= 'A' && wrappedContent[end] <= 'Z') ||
						(wrappedContent[end] >= 'a' && wrappedContent[end] <= 'z'))
				) {
					lineBuffer += wrappedContent.slice(index, end + 1);
					index = end + 1;
					continue;
				}
			}
		}

		const char = wrappedContent[index];
		const charWidth = wcwidth(char);
		if (lineLengthBuffer + charWidth <= maxWidth) {
			lineBuffer += char;
			lineLengthBuffer += charWidth;
		} else {
			result.push({
				content: lineBuffer,
				role,
				createdAt,
				isFirstLine,
				lineLength: lineLengthBuffer,
			});
			if (isFirstLine) isFirstLine = false;
			lineBuffer = char;
			lineLengthBuffer = charWidth;
		}
		index++;
	}
	if (lineBuffer.length !== 0) {
		result.push({
			content: lineBuffer,
			role,
			createdAt,
			isFirstLine,
			isIncomplete: lineLengthBuffer !== maxWidth,
			lineLength: lineLengthBuffer,
		});
	}
	return result;
}
