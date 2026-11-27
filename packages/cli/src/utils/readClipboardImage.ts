import {spawn} from 'node:child_process';

/**
 * Reads an image from the system clipboard, Linux/WSL only.
 *
 * WSLg shares the Windows clipboard with the Wayland/X11 session, so wl-paste
 * and xclip work when installed. The zero-install fallback is WSL interop:
 * powershell.exe reads the Windows clipboard through WinForms (which needs an
 * STA thread), downscales, and prints base64 PNG on stdout — base64 rather
 * than a file so no /mnt/c path translation is involved.
 *
 * Returns null when the clipboard holds no image. Throws when no clipboard
 * tool is available, the platform is unsupported, or the image is too large.
 */

/** Hard cap on any source: 20 MB of base64. */
export const MAX_IMAGE_BASE64_LENGTH = 20 * 1024 * 1024;

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
$imageExtensions = @(${IMAGE_FILE_EXTENSIONS.map(ext => `'${ext}'`).join(', ')});
$img = $null;
try { $img = [System.Windows.Forms.Clipboard]::GetImage() } catch { }
if ($null -eq $img -and [System.Windows.Forms.Clipboard]::ContainsFileDropList()) {
	foreach ($file in [System.Windows.Forms.Clipboard]::GetFileDropList()) {
		if ($imageExtensions -notcontains [System.IO.Path]::GetExtension($file)) { continue }
		if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { continue }
		try { $img = [System.Drawing.Image]::FromFile($file) } catch { $img = $null }
		if ($null -ne $img) { break }
	}
}
if ($null -eq $img) { exit 1 }
$s = [Math]::Min(1.0, $max / [Math]::Max($img.Width, $img.Height));
$w = [Math]::Max(1, [int]($img.Width * $s)); $h = [Math]::Max(1, [int]($img.Height * $s));
$out = New-Object System.Drawing.Bitmap($w, $h);
$g = [System.Drawing.Graphics]::FromImage($out);
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic;
$g.DrawImage($img, 0, 0, $w, $h); $g.Dispose();
$ms = New-Object System.IO.MemoryStream;
$out.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png);
$b64 = [Convert]::ToBase64String($ms.ToArray());
$ms.Dispose(); $out.Dispose(); $img.Dispose();
[Console]::Out.Write($b64)
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

export async function readClipboardImage(): Promise<ClipboardImage | null> {
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

		const base64 = (
			source.base64Output
				? result.stdout.toString('utf8')
				: result.stdout.toString('base64')
		).replace(/\s+/g, '');

		if (base64.length > MAX_IMAGE_BASE64_LENGTH) {
			throw new Error('Image too large: the clipboard image exceeds 20 MB');
		}

		const png = Buffer.from(base64, 'base64');
		const size = readPngSize(png);
		// Output that is not really a PNG (an error message on stdout, a
		// clipboard format we cannot use) must not become an image chip.
		if (!size) continue;

		return {
			dataUrl: `data:image/png;base64,${base64}`,
			width: size.width,
			height: size.height,
		};
	}

	if (!anyAvailable) {
		throw new Error(
			'No clipboard image tool found (install wl-clipboard, or run under WSL for powershell.exe)',
		);
	}

	return null;
}
