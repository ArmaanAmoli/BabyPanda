import type {VisibleMessage, FlattenedLine, ViewPortMessage} from '../types';
import {
	MARGIN_TOP_MESSAGE_BOX,
	PADDING_MESSAGE_BOX,
} from '../components/messageBox';

const MESSAGE_OVERHEAD = MARGIN_TOP_MESSAGE_BOX + 2 * PADDING_MESSAGE_BOX;

export function selectVisibleMessages(
	messages: ViewPortMessage[],
	budget: number,
	offset: number,
): {visible: VisibleMessage[]; lineCount: number} {
	const flat: FlattenedLine[] = [];
	messages.forEach((message, messageIndex) => {
		message.lines.forEach(line => flat.push({line, messageIndex}));
	});

	const total = flat.length;
	const bottomIndex = Math.max(0, total - 1 - offset);
	const includedMessages = new Set<number>();
	const window: FlattenedLine[] = [];
	let used = 0;

	for (let index = bottomIndex; index >= 0; index--) {
		const entry = flat[index];
		if (!entry) break;
		const cost =
			1 + (includedMessages.has(entry.messageIndex) ? 0 : MESSAGE_OVERHEAD);
		if (used + cost > budget) break;
		used += cost;
		includedMessages.add(entry.messageIndex);
		window.unshift(entry);
	}

	const visible: VisibleMessage[] = [];
	let lineCount = 0;
	for (const entry of window) {
		lineCount++;
		const last = visible.at(-1);
		if (last && last.messageIndex === entry.messageIndex) {
			last.content += `\n${entry.line.content}`;
		} else {
			visible.push({
				messageIndex: entry.messageIndex,
				role: entry.line.role,
				createdAt: entry.line.createdAt,
				content: entry.line.content,
			});
		}
	}

	return {visible, lineCount};
}
