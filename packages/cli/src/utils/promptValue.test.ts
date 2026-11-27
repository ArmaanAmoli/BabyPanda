import {describe, expect, test} from 'bun:test';
import {
	createImageSegment,
	createPasteSegment,
	getChipRangeAfter,
	getChipRangeBefore,
	getImageSegments,
	initializeImageIdFromHistory,
	isChipSegment,
	isEmptyPrompt,
	normalizePromptValue,
	promptText,
	replaceRange,
	textValue,
} from './promptValue';

const TINY_DATA_URL = 'data:image/png;base64,iVBORw0KGgo=';

function makeImage() {
	return createImageSegment({width: 64, height: 48, dataUrl: TINY_DATA_URL});
}

describe('image segments', () => {
	test('promptText keeps the image placeholder inline', () => {
		const image = makeImage();
		const value = replaceRange(textValue('hi '), 3, 3, image);
		expect(promptText(value)).toBe(`hi [image: ${image.name}]`);
		expect(image.collapsed).toBe(true);
	});

	test('an image-only prompt is not empty', () => {
		const value = replaceRange(textValue(''), 0, 0, makeImage());
		expect(isEmptyPrompt(value)).toBe(false);
	});

	test('an image inserts at the cursor and deletes atomically', () => {
		const image = makeImage();
		let value = replaceRange(textValue('look at this'), 4, 4, image);
		expect(promptText(value)).toBe(`look${image.text} at this`);
		expect(getImageSegments(value)).toHaveLength(1);

		const before = getChipRangeBefore(value, 4 + image.text.length);
		expect(before).toEqual({start: 4, end: 4 + image.text.length});
		expect(getChipRangeAfter(value, 4)).toEqual(before);

		value = replaceRange(value, before!.start, before!.end, null);
		expect(promptText(value)).toBe('look at this');
		expect(getImageSegments(value)).toHaveLength(0);
	});

	test('normalize keeps text on either side of an image separate', () => {
		const value = normalizePromptValue({
			segments: [
				{kind: 'text', text: 'a'},
				makeImage(),
				{kind: 'text', text: 'b'},
			],
		});
		expect(value.segments.map(segment => segment.kind)).toEqual([
			'text',
			'image',
			'text',
		]);
	});

	test('a partial erase removes the whole chip instead of slicing it', () => {
		const image = makeImage();
		const value = replaceRange(textValue(''), 0, 0, image);
		// Ctrl+W over the placeholder: a range strictly inside the chip.
		const erased = replaceRange(value, 7, image.text.length, null);
		expect(getImageSegments(erased)).toHaveLength(0);
		expect(promptText(erased)).toBe('');
	});

	test('a deletion starting inside a chip removes the whole chip', () => {
		const image = makeImage();
		const value = replaceRange(textValue(''), 0, 0, image);
		const erased = replaceRange(value, 3, 5, null);
		expect(getImageSegments(erased)).toHaveLength(0);
	});

	test('an insertion strictly inside a chip is clamped to its start', () => {
		const image = makeImage();
		let value = replaceRange(textValue(''), 0, 0, image);
		value = replaceRange(value, 4, 4, {kind: 'text', text: 'hi '});
		expect(promptText(value)).toBe(`hi ${image.text}`);
		expect(getImageSegments(value)).toHaveLength(1);
	});

	test('deletions next to a chip leave it untouched', () => {
		const image = makeImage();
		let value = replaceRange(textValue('ab'), 2, 2, image);
		value = replaceRange(
			value,
			promptText(value).length,
			promptText(value).length,
			{
				kind: 'text',
				text: 'cd',
			},
		);
		// Delete the text before the chip: the range ends at the chip's start.
		const before = replaceRange(value, 0, 2, null);
		expect(getImageSegments(before)).toHaveLength(1);
		// Delete the text after the chip: the range starts at the chip's end.
		const after = replaceRange(
			value,
			2 + image.text.length,
			promptText(value).length,
			null,
		);
		expect(getImageSegments(after)).toHaveLength(1);
	});

	test('getImageSegments returns images in chip order', () => {
		const first = makeImage();
		const second = makeImage();
		let value = replaceRange(textValue('x'), 1, 1, first);
		value = replaceRange(
			value,
			promptText(value).length,
			promptText(value).length,
			second,
		);
		expect(getImageSegments(value).map(image => image.id)).toEqual([
			first.id,
			second.id,
		]);
	});
});

describe('isChipSegment', () => {
	test('covers images and collapsed pastes only', () => {
		expect(isChipSegment(makeImage())).toBe(true);
		expect(isChipSegment(createPasteSegment('x'))).toBe(true);
		expect(isChipSegment({...createPasteSegment('x'), collapsed: false})).toBe(
			false,
		);
		expect(isChipSegment({kind: 'text', text: 'x'})).toBe(false);
	});
});

describe('paste chips (regression)', () => {
	test('collapsed pastes keep their atomic ranges', () => {
		const paste = createPasteSegment('line1\nline2\nline3');
		const value = replaceRange(textValue('ab'), 1, 1, paste);
		expect(getChipRangeBefore(value, 1 + paste.text.length)).toEqual({
			start: 1,
			end: 1 + paste.text.length,
		});
		expect(getChipRangeAfter(value, 1)).toEqual({
			start: 1,
			end: 1 + paste.text.length,
		});
	});
});

describe('initializeImageIdFromHistory', () => {
	test('continues after the highest image name in history', () => {
		initializeImageIdFromHistory([
			'see [🖼 image-4.png · 1×1 · 3 B]',
			'and [image: image-7.png]',
			'no images here',
		]);
		expect(makeImage().name).toBe('image-8.png');
	});

	test('with no images in history the first paste is image-1.png', () => {
		initializeImageIdFromHistory(['plain text', 'no chips at all']);
		expect(makeImage().name).toBe('image-1.png');
	});
});
