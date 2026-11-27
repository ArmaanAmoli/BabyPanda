import {describe, expect, test} from 'bun:test';
import type {MultiModalContent} from '@baby-panda/types';
import {buildUserContent, userContentToDisplay} from './userContent';
import {
	createImageSegment,
	promptText,
	replaceRange,
	textValue,
} from './promptValue';

describe('buildUserContent', () => {
	test('text-only prompts keep the plain string form', () => {
		const value = textValue('hello');
		expect(buildUserContent('hello', value)).toBe('hello');
	});

	test('image chips become image parts after the text part, in order', () => {
		const first = createImageSegment({
			width: 1,
			height: 1,
			dataUrl: 'data:image/png;base64,AAA=',
		});
		const second = createImageSegment({
			width: 2,
			height: 2,
			dataUrl: 'data:image/png;base64,BBB=',
		});
		let value = replaceRange(textValue('see '), 4, 4, first);
		value = replaceRange(
			value,
			promptText(value).length,
			promptText(value).length,
			second,
		);

		const content = buildUserContent(promptText(value), value);
		expect(Array.isArray(content)).toBe(true);
		const parts = content as MultiModalContent;
		expect(parts).toHaveLength(3);
		expect(parts[0]).toEqual({type: 'text', text: promptText(value)});
		expect(parts[1]).toEqual({type: 'image', image: first.dataUrl});
		expect(parts[2]).toEqual({type: 'image', image: second.dataUrl});
		// The text part keeps the placeholders inline.
		expect(promptText(value)).toContain(first.text);
		expect(promptText(value)).toContain(second.text);
	});
});

const PNG_1X1 =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('userContentToDisplay', () => {
	test('plain strings pass through', () => {
		expect(userContentToDisplay('plain')).toBe('plain');
	});

	test('an inline placeholder becomes the full chip, with no extra marker', () => {
		const display = userContentToDisplay([
			{type: 'text', text: 'look [image: image-1.png]'},
			{type: 'image', image: PNG_1X1},
		]);
		expect(display.startsWith('look [🖼 image-1.png · 1×1 · ')).toBe(true);
		expect(display.endsWith('B]')).toBe(true);
		// The short emoji marker must not appear anywhere.
		expect(display).not.toContain('[🖼 image 1]');
		expect(display).not.toContain('[image: image-1.png]');
	});

	test('several images each get exactly one full chip', () => {
		const display = userContentToDisplay([
			{
				type: 'text',
				text: 'a [image: image-1.png] b [image: image-2.png]',
			},
			{type: 'image', image: PNG_1X1},
			{type: 'image', image: PNG_1X1},
		]);
		expect(display).toContain('[🖼 image-1.png · 1×1 · ');
		expect(display).toContain('[🖼 image-2.png · 1×1 · ');
		expect(display).not.toContain('[🖼 image 1]');
	});

	test('an image-only message renders one full chip line', () => {
		const display = userContentToDisplay([{type: 'image', image: PNG_1X1}]);
		expect(display.startsWith('[🖼 image-1.png · 1×1 · ')).toBe(true);
	});

	test('an image part without a placeholder is appended as a chip line', () => {
		const display = userContentToDisplay([
			{type: 'text', text: 'look'},
			{type: 'image', image: PNG_1X1},
		]);
		expect(display.startsWith('look\n[🖼 image-1.png · 1×1 · ')).toBe(true);
	});

	test('a placeholder with no matching image part is left alone', () => {
		expect(
			userContentToDisplay([{type: 'text', text: '[image: ghost.png]'}]),
		).toBe('[image: ghost.png]');
	});

	test('null and non-array values degrade gracefully', () => {
		expect(userContentToDisplay(null)).toBe('');
		expect(userContentToDisplay(undefined)).toBe('');
	});
});
