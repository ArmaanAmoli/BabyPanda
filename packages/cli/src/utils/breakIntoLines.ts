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
	for (const char of wrappedContent) {
		// A newline ends the current line; it must not become part of the next
		// one or re-joining the lines would inject blank rows.
		if (char === '\n') {
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
			continue;
		}

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
