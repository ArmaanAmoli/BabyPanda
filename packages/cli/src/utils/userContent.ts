import type {MultiModalContent} from '@baby-panda/types';
import {getImageSegments, type PromptValue} from './promptValue';
import {formatImageChip} from './promptLayout';
import {readPngSize} from './readClipboardImage';

/**
 * Builds the WebSocket `content` for a user message. A prompt without images
 * keeps today's plain-string form; with images it becomes OpenAI-style parts:
 * one text part followed by one image part per image chip, in chip order.
 * The caller decides the text — for a plain message it is the flattened
 * prompt (image placeholders inline), for a skill invocation it is the
 * leftover message with the placeholders appended.
 */
export function buildUserContent(
	text: string,
	value: PromptValue,
): string | MultiModalContent {
	const images = getImageSegments(value);
	if (images.length === 0) return text;

	const parts: MultiModalContent = [{type: 'text', text}];
	for (const image of images) {
		parts.push({type: 'image', image: image.dataUrl});
	}
	return parts;
}

/** The full chip label for a stored image part, matching the prompt box. */
function imagePartChip(dataUrl: string, name: string): string {
	// The PNG header (and with it the dimensions) lives in the first 24 bytes,
	// so only the first few base64 characters need decoding, even for a 20 MB
	// image. Width is unlimited: the chat does not truncate chips.
	const base64Start = dataUrl.indexOf(',') + 1;
	const header = Buffer.from(
		dataUrl.slice(base64Start, base64Start + 40),
		'base64',
	);
	const size = readPngSize(header) ?? {width: 0, height: 0};
	return formatImageChip(
		{name, width: size.width, height: size.height, dataUrl},
		Number.POSITIVE_INFINITY,
	);
}

/**
 * Display string for a user message's stored content. Every image gets
 * exactly one representation: the full chip (name, dimensions, size) the
 * prompt box shows, substituted for its inline `[image: …]` placeholder.
 * Image parts without a placeholder are appended as chip lines. Used by the
 * live echo and by history reload so both render the same thing. Accepts
 * unknown input because history rows come from the DB as parsed JSON.
 */
export function userContentToDisplay(content: unknown): string {
	if (typeof content === 'string') return content;
	if (!Array.isArray(content)) return content == null ? '' : String(content);

	const texts: string[] = [];
	const imageUrls: string[] = [];
	for (const part of content) {
		if (part == null || typeof part !== 'object') continue;
		const record = part as {type?: unknown; text?: unknown; image?: unknown};
		if (record.type === 'text' && typeof record.text === 'string') {
			texts.push(record.text);
		} else if (record.type === 'image' && typeof record.image === 'string') {
			imageUrls.push(record.image);
		}
	}

	let index = 0;
	const text = texts
		.join('\n')
		.replace(/\[image: ([^\]]+)\]/g, (placeholder, name: string) => {
			const dataUrl = imageUrls[index++];
			return dataUrl === undefined ? placeholder : imagePartChip(dataUrl, name);
		});

	const leftovers = imageUrls
		.slice(index)
		.map((dataUrl, leftoverIndex) =>
			imagePartChip(dataUrl, `image-${index + leftoverIndex + 1}.png`),
		);

	return [text, ...leftovers].filter(line => line.length > 0).join('\n');
}
