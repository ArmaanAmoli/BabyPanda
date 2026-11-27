import {describe, expect, test} from 'bun:test';
import {MAX_IMAGE_BASE64_LENGTH, readPngSize} from './readClipboardImage';

function pngHeader(width: number, height: number): Buffer {
	const png = Buffer.alloc(24);
	Buffer.from('\x89PNG\r\n\x1a\n', 'latin1').copy(png, 0);
	png.writeUInt32BE(13, 8); // IHDR chunk length
	png.write('IHDR', 12, 'latin1');
	png.writeUInt32BE(width, 16);
	png.writeUInt32BE(height, 20);
	return png;
}

describe('readPngSize', () => {
	test('reads width and height from the IHDR chunk', () => {
		expect(readPngSize(pngHeader(1920, 1080))).toEqual({
			width: 1920,
			height: 1080,
		});
	});

	test('rejects non-PNG and truncated buffers', () => {
		expect(readPngSize(Buffer.from('not a png at all, really'))).toBeNull();
		expect(readPngSize(Buffer.alloc(10))).toBeNull();
	});
});

test('the base64 cap is 20 MB', () => {
	expect(MAX_IMAGE_BASE64_LENGTH).toBe(20 * 1024 * 1024);
});
