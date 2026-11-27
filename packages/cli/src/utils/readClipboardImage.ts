import {spawn} from 'node:child_process';

/**
 * Reads images from the system clipboard, Linux/WSL only.
 *
 * WSLg shares the Windows clipboard with the Wayland/X11 session, so wl-paste
 * and xclip work when installed. The zero-install fallback is WSL interop:
 * powershell.exe reads the Windows clipboard through WinForms (which needs an
 * STA thread), downscales, and prints base64 PNG on stdout — base64 rather
 * than a file so no /mnt/c path translation is involved.
 *
 * A clipboard can hold several images at once: Explorer's Copy puts a CF_HDROP
 * list of paths on it, so selecting several image files and copying them
 * yields several images. The PowerShell fallback therefore prints one base64
 * PNG per line and this module splits them back apart; the native tools only
 * ever carry one image, so they yield at most one.
 *
 * Returns an empty array when the clipboard holds no image. Throws when no
 * clipboard tool is available, the platform is unsupported, or an image is
 * too large.
 */

/** Hard cap on any single source image: 20 MB of base64. */
export const MAX_IMAGE_BASE64_LENGTH = 20 * 1024 * 1024;

/**
 * Cap on images per paste. A prompt carrying more than this is not reviewable
 * by a human, and each image is up to 20 MB, so the cap bounds both the chip
 * rows and the payload. The PowerShell fallback stops reading at the same
 * number so a 500-file selection never reaches this module.
 */
export const MAX_IMAGES_PER_PASTE = 10;

const NATIVE_TIMEOUT_MS = 5_000;
const POWERSHELL_TIMEOUT_MS = 30_000;

/**
 * Extensions the PowerShell fallback accepts from a clipboard file-drop list.
 * Explorer's "Copy" puts CF_HDROP on the clipboard — paths, not pixels — so a
 * copied image file has to be read back from disk. Every extension here is
 * decodable by System.Drawing, which re-encodes it as PNG below.
 */
export const IMAGE_FILE_EXTENSIONS = [
	'.png',
	'.jpg',
	'.jpeg',
	'.gif',
	'.bmp',
	'.tif',
	'.tiff',
];

export const POWERSHELL_SCRIPT = `
Add-Type -AssemblyName System.Windows.Forms,System.Drawing;
$max = 1568;
$maxImages = ${MAX_IMAGES_PER_PASTE};
$newline = [char]10;
$imageExtensions = @(${IMAGE_FILE_EXTENSIONS.map(ext => `'${ext}'`).join(', ')});
$candidates = New-Object System.Collections.ArrayList;

# Real clipboard image data (a screenshot, a browser's "Copy image") wins when
# it is present: it is the cheaper path and the one users hit most often.
try {
	$img = [System.Windows.Forms.Clipboard]::GetImage();
	if ($null -ne $img) { $null = $candidates.Add($img) }
} catch { }

# Otherwise walk the file-drop list, so copying several image files at once
# yields all of them in the order Explorer listed them.
if ($candidates.Count -eq 0 -and [System.Windows.Forms.Clipboard]::ContainsFileDropList()) {
	foreach ($file in [System.Windows.Forms.Clipboard]::GetFileDropList()) {
		if ($candidates.Count -ge $maxImages) { break }
		if ($imageExtensions -notcontains [System.IO.Path]::GetExtension($file)) { continue }
		if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { continue }
		try {
			$loaded = [System.Drawing.Image]::FromFile($file);
			if ($null -ne $loaded) { $null = $candidates.Add($loaded) }
		} catch { }
	}
}

$lines = New-Object System.Collections.ArrayList;
foreach ($img in $candidates) {
	try {
		$s = [Math]::Min(1.0, $max / [Math]::Max($img.Width, $img.Height));
		$w = [Math]::Max(1, [int]($img.Width * $s)); $h = [Math]::Max(1, [int]($img.Height * $s));
		$out = New-Object System.Drawing.Bitmap($w, $h);
		$g = [System.Drawing.Graphics]::FromImage($out);
		$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic;
		$g.DrawImage($img, 0, 0, $w, $h); $g.Dispose();
		$ms = New-Object System.IO.MemoryStream;
		$out.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png);
		$null = $lines.Add([Convert]::ToBase64String($ms.ToArray()));
		$ms.Dispose(); $out.Dispose();
	} catch { }
	$img.Dispose();
}
[Console]::Out.Write(($lines -join $newline))
`;

export interface ClipboardImage {
	dataUrl: string;
	width: number;
	height: number;
}

interface CommandResult {
	/** The command could not be spawned at all (not installed). */
	unavailable: boolean;
	ok: boolean;
	stdout: Buffer;
}

function run(
	command: string,
	args: string[],
	timeoutMs: number,
): Promise<CommandResult> {
	return new Promise(resolve => {
		const child = spawn(command, args, {stdio: ['ignore', 'pipe', 'ignore']});
		const chunks: Buffer[] = [];
		let settled = false;

		const finish = (result: CommandResult) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolve(result);
		};

		const timer = setTimeout(() => {
			child.kill();
			finish({unavailable: false, ok: false, stdout: Buffer.alloc(0)});
		}, timeoutMs);

		child.once('error', () => {
			finish({unavailable: true, ok: false, stdout: Buffer.alloc(0)});
		});
		child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
		child.once('close', code => {
			finish({
				unavailable: false,
				ok: code === 0,
				stdout: Buffer.concat(chunks),
			});
		});
	});
}

/**
 * Dimensions from the PNG header: 8-byte signature, then the IHDR chunk's
 * length/type (8 bytes), then width and height as big-endian uint32 at
 * offsets 16 and 20. Returns null for anything that is not a PNG.
 */
export function readPngSize(
	png: Buffer,
): {width: number; height: number} | null {
	if (png.length < 24) return null;
	if (png.subarray(0, 8).toString('latin1') !== '\x89PNG\r\n\x1a\n')
		return null;
	if (png.subarray(12, 16).toString('latin1') !== 'IHDR') return null;
	return {width: png.readUInt32BE(16), height: png.readUInt32BE(20)};
}

/**
 * Splits one source's stdout into images.
 *
 * The PowerShell fallback prints one base64 PNG per line, because base64
 * itself never contains a newline; the native tools print raw PNG bytes,
 * which is exactly one image. Anything that is not a PNG — an error message
 * on stdout, a clipboard format we cannot use — is dropped rather than
 * becoming a chip.
 */
export function decodeClipboardImages(
	stdout: Buffer,
	base64Output: boolean,
): ClipboardImage[] {
	const blobs = base64Output
		? stdout.toString('utf8').split('\n')
		: [stdout.toString('base64')];

	const images: ClipboardImage[] = [];
	for (const blob of blobs) {
		const base64 = blob.replace(/\s+/g, '');
		if (base64.length === 0) continue;

		if (base64.length > MAX_IMAGE_BASE64_LENGTH) {
			throw new Error('Image too large: the clipboard image exceeds 20 MB');
		}

		const png = Buffer.from(base64, 'base64');
		const size = readPngSize(png);
		if (!size) continue;

		images.push({
			dataUrl: `data:image/png;base64,${base64}`,
			width: size.width,
			height: size.height,
		});
	}

	return images;
}

export async function readClipboardImages(): Promise<ClipboardImage[]> {
	if (process.platform !== 'linux') {
		throw new Error('Image paste is not supported on this platform');
	}

	const sources = [
		{
			command: 'wl-paste',
			args: ['-t', 'image/png'],
			timeoutMs: NATIVE_TIMEOUT_MS,
			base64Output: false,
		},
		{
			command: 'xclip',
			args: ['-selection', 'clipboard', '-t', 'image/png', '-o'],
			timeoutMs: NATIVE_TIMEOUT_MS,
			base64Output: false,
		},
		{
			command: 'powershell.exe',
			args: [
				'-NoProfile',
				'-NonInteractive',
				'-STA',
				'-Command',
				POWERSHELL_SCRIPT,
			],
			timeoutMs: POWERSHELL_TIMEOUT_MS,
			base64Output: true,
		},
	];

	let anyAvailable = false;

	for (const source of sources) {
		const result = await run(source.command, source.args, source.timeoutMs);
		if (result.unavailable) continue;
		anyAvailable = true;
		// A non-zero exit or empty output means "no image on the clipboard"
		// for this source; try the next one.
		if (!result.ok || result.stdout.length === 0) continue;

		const images = decodeClipboardImages(result.stdout, source.base64Output);
		// A source that produced nothing usable is not the answer either, so
		// fall through to the next one exactly as before.
		if (images.length === 0) continue;

		return images.slice(0, MAX_IMAGES_PER_PASTE);
	}

	if (!anyAvailable) {
		throw new Error(
			'No clipboard image tool found (install wl-clipboard, or run under WSL for powershell.exe)',
		);
	}

	return [];
}
