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
	// const wrappedContent = Bun.markdown.ansi(content, {columns: maxWidth});
	const wrappedContent = content;
	const result: MessageLine[] = [];
	let lineLengthBuffer = 0;
	let lineBuffer: string = '';
	let isFirstLine = true;
	for (const char of wrappedContent) {
		const charWidth = wcwidth(char);
		if (char !== '\n' && lineLengthBuffer + charWidth <= maxWidth) {
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
			lineBuffer = char;
			lineLengthBuffer = wcwidth(char);
			if (isFirstLine) isFirstLine = false;
		}
	}
	if (lineBuffer.length !== 0) {
		result.push(
			lineLengthBuffer === maxWidth
				? {
						content: lineBuffer,
						role,
						createdAt,
						lineLength: maxWidth,
						isFirstLine: true,
					}
				: {
						content: lineBuffer,
						role,
						createdAt,
						isFirstLine: true,
						isIncomplete: true,
						lineLength: lineLengthBuffer,
					},
		);
	}
	return result;
}
