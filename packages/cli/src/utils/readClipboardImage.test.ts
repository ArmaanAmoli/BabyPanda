import {describe, expect, test} from 'bun:test';
import {
	IMAGE_FILE_EXTENSIONS,
	MAX_IMAGE_BASE64_LENGTH,
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

describe('the PowerShell fallback', () => {
	test('reads a copied image file back from the clipboard file-drop list', () => {
		// Explorer's "Copy" puts CF_HDROP (paths, not pixels) on the clipboard,
		// so GetImage() alone reports "no image on clipboard".
		expect(POWERSHELL_SCRIPT).toContain('ContainsFileDropList()');
		expect(POWERSHELL_SCRIPT).toContain('GetFileDropList()');
		expect(POWERSHELL_SCRIPT).toContain('[System.Drawing.Image]::FromFile');
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
});
