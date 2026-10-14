import {CleanedMessage} from '@baby-panda/types';
import {MessageLine} from './breakIntoLines';

export function combineLinesToMessage(lines: MessageLine[]): CleanedMessage[] {
	const result: CleanedMessage[] = [];
	lines.forEach(line => {
		const lastMessage = result.at(-1);
		if (!lastMessage || (line.role !== lastMessage.role && line.isFirstLine)) {
			result.push({
				role: line.role,
				content: line.content,
				createdAt: line.createdAt,
			});
		} else {
			lastMessage.content += `${line.content}`;
		}
	});
	return result;
}
