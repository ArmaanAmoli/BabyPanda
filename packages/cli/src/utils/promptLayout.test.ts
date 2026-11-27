import {describe, expect, test} from 'bun:test';
import {createImageSegment, replaceRange, textValue} from './promptValue';
import {formatImageChip, wrapPromptValue} from './promptLayout';

describe('image chips in the layout', () => {
	test('an image segment renders as exactly one chip row', () => {
		const image = createImageSegment({
			width: 1920,
			height: 1080,
			dataUrl: `data:image/png;base64,${'A'.repeat(400)}`,
		});
		const value = replaceRange(textValue('before'), 6, 6, image);
		const lines = wrapPromptValue(value, 80);

		const chipLines = lines.filter(line => line.isChip);
		expect(chipLines).toHaveLength(1);
		expect(chipLines[0]!.text).toContain(image.name);
		expect(chipLines[0]!.text).toContain('1920×1080');
		// The chip row spans the placeholder in the flattened text, so the
		// cursor still maps onto it.
		expect(chipLines[0]!.start).toBe(6);
		expect(chipLines[0]!.end).toBe(6 + image.text.length);
		expect(lines).toHaveLength(2);
	});

	test('formatImageChip shows name, dimensions and estimated size', () => {
		const image = createImageSegment({
			width: 10,
			height: 10,
			dataUrl: 'data:image/png;base64,AAAA',
		});
		expect(formatImageChip(image, 200)).toBe(`[🖼 ${image.name} · 10×10 · 3 B]`);
	});

	test('formatImageChip falls back to a truncated minimal label', () => {
		const image = createImageSegment({
			width: 10,
			height: 10,
			dataUrl: 'data:image/png;base64,AAAA',
		});
		const minimal = `[🖼 ${image.name}]`;
		expect(formatImageChip(image, 10)).toBe(minimal.slice(0, 10));
	});

	test('dimensions are omitted when the PNG header gave none', () => {
		const image = createImageSegment({
			width: 0,
			height: 0,
			dataUrl: 'data:image/png;base64,AAAA',
		});
		expect(formatImageChip(image, 200)).toBe(`[🖼 ${image.name} · 3 B]`);
	});
});
