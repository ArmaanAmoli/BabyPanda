import {describe, expect, test} from 'bun:test';
import {
	decodeClipboardImages,
	IMAGE_FILE_EXTENSIONS,
	MAX_IMAGE_BASE64_LENGTH,
	MAX_IMAGES_PER_PASTE,
	POWERSHELL_SCRIPT,
	readPngSize,
} from './readClipboardImage';

function pngHeader(width: number, height: number): Buffer {
	const png = Buffer.alloc(24);
	Buffer.from('\x89PNG\r\n\x1a\n', 'latin1').copy(png, 0);
	png.writeUInt32BE(13, 8); // IHDR chunk length
	png.write('IHDR', 12, 'latin1');
	png.writeUInt32BE(width, 16);
	png.writeUInt32BE(height, 20);
	return png;
}

/** Stand-in for a real PNG: a valid header is all the reader inspects. */
function png(width: number, height: number): Buffer {
	return pngHeader(width, height);
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

describe('decodeClipboardImages', () => {
	test('splits the PowerShell output into one image per line', () => {
		const stdout = Buffer.from(
			[
				png(1200, 900).toString('base64'),
				png(800, 600).toString('base64'),
				png(64, 64).toString('base64'),
			].join('\n'),
			'utf8',
		);

		const images = decodeClipboardImages(stdout, true);
		expect(images).toHaveLength(3);
		expect(images.map(image => [image.width, image.height])).toEqual([
			[1200, 900],
			[800, 600],
			[64, 64],
		]);
		// Each image carries its own data URL, so nothing is shared or lost.
		expect(new Set(images.map(image => image.dataUrl)).size).toBe(3);
		expect(images[0]!.dataUrl.startsWith('data:image/png;base64,')).toBe(true);
	});

	test('keeps the clipboard order of the drop list', () => {
		const stdout = Buffer.from(
			[png(10, 20).toString('base64'), png(30, 40).toString('base64')].join(
				'\n',
			),
			'utf8',
		);

		expect(
			decodeClipboardImages(stdout, true).map(image => image.width),
		).toEqual([10, 30]);
	});

	test('drops blank lines and non-PNG output instead of making chips', () => {
		const stdout = Buffer.from(
			[
				'',
				png(1200, 900).toString('base64'),
				'   ',
				'Error: target image/png not available',
				png(800, 600).toString('base64'),
				'',
			].join('\n'),
			'utf8',
		);

		const images = decodeClipboardImages(stdout, true);
		expect(images).toHaveLength(2);
		expect(images.map(image => image.width)).toEqual([1200, 800]);
	});

	test('treats raw native-tool bytes as a single image', () => {
		const images = decodeClipboardImages(png(1920, 1080), false);
		expect(images).toHaveLength(1);
		expect(images[0]).toMatchObject({width: 1920, height: 1080});
	});

	test('returns nothing for empty output', () => {
		expect(decodeClipboardImages(Buffer.alloc(0), true)).toEqual([]);
		expect(decodeClipboardImages(Buffer.from('\n\n'), true)).toEqual([]);
	});

	test('rejects an image past the 20 MB cap', () => {
		const oversized = 'A'.repeat(MAX_IMAGE_BASE64_LENGTH + 1);
		expect(() =>
			decodeClipboardImages(Buffer.from(oversized, 'utf8'), true),
		).toThrow(/exceeds 20 MB/);
	});
});

describe('the PowerShell fallback', () => {
	test('reads every copied image file back from the drop list', () => {
		// Explorer's "Copy" puts CF_HDROP (paths, not pixels) on the clipboard,
		// so GetImage() alone reports "no image on clipboard".
		expect(POWERSHELL_SCRIPT).toContain('ContainsFileDropList()');
		expect(POWERSHELL_SCRIPT).toContain('GetFileDropList()');
		expect(POWERSHELL_SCRIPT).toContain('[System.Drawing.Image]::FromFile');
		// The loop must not stop at the first decodable file: the only `break`
		// allowed is the one that enforces the paste cap.
		const breaks = POWERSHELL_SCRIPT.match(/break/g) ?? [];
		expect(breaks).toHaveLength(1);
		expect(POWERSHELL_SCRIPT).toContain(
			'if ($candidates.Count -ge $maxImages) { break }',
		);
	});

	test('only accepts extensions System.Drawing can decode', () => {
		for (const extension of IMAGE_FILE_EXTENSIONS) {
			expect(extension).toMatch(/^\.(png|jpe?g|gif|bmp|tiff?)$/);
		}
		// The list is embedded in the script, not duplicated by hand.
		for (const extension of IMAGE_FILE_EXTENSIONS) {
			expect(POWERSHELL_SCRIPT).toContain(`'${extension}'`);
		}
	});

	test('still prefers real clipboard image data', () => {
		expect(POWERSHELL_SCRIPT).toContain('Clipboard]::GetImage()');
		expect(POWERSHELL_SCRIPT.indexOf('GetImage()')).toBeLessThan(
			POWERSHELL_SCRIPT.indexOf('ContainsFileDropList()'),
		);
	});

	test('prints one base64 PNG per line so several survive the pipe', () => {
		// Base64 never contains a newline, so a newline is an unambiguous
		// separator; the reader splits on exactly this.
		expect(POWERSHELL_SCRIPT).toContain('$newline = [char]10');
		expect(POWERSHELL_SCRIPT).toContain('-join $newline');
	});

	test('stops reading files at the paste cap', () => {
		expect(POWERSHELL_SCRIPT).toContain(
			`$maxImages = ${MAX_IMAGES_PER_PASTE}`,
		);
		expect(POWERSHELL_SCRIPT).toContain('$candidates.Count -ge $maxImages');
	});
});
