/**
 * BabyPanda startup/exit banner.
 *
 * Ported from `docs/panda-banner.js`, which stays the verbatim reference. The
 * panda is rasterised from vector shapes into a half-block grid (`▀` carries a
 * foreground and a background colour, so one character cell is two pixels), and
 * the wordmark is a 5x5 pixel font rendered the same way.
 *
 * The raster is cached per resolution scale: it is deterministic and the only
 * things that change between calls are the session id and the terminal width.
 */

type RGB = [number, number, number];

interface Layer {
	/** Hit test in the 36x32 design space. */
	t: (x: number, y: number) => boolean;
	/** Fill colour, or a function of the design-space position. */
	c: RGB | ((x: number, y: number) => RGB);
	/** Optional alpha, blended over whatever is already there. */
	a?: number;
}

const RESET = '\x1b[0m';
const INK: RGB = [22, 22, 27];

const fg = ([r, g, b]: RGB) => `\x1b[38;2;${r};${g};${b}m`;
const bg = ([r, g, b]: RGB) => `\x1b[48;2;${r};${g};${b}m`;
const dim = (text: string) => `\x1b[38;2;140;140;150m${text}${RESET}`;

function mix(a: RGB, b: RGB, k: number): RGB {
	return [
		Math.round(a[0] * (1 - k) + b[0] * k),
		Math.round(a[1] * (1 - k) + b[1] * k),
		Math.round(a[2] * (1 - k) + b[2] * k),
	];
}

// ---------- shape helpers (design space is 36 x 32) ----------

function ellipse(cx: number, cy: number, rx: number, ry: number, deg = 0) {
	const a = (deg * Math.PI) / 180;
	const cos = Math.cos(a);
	const sin = Math.sin(a);
	return (x: number, y: number) => {
		const dx = x - cx;
		const dy = y - cy;
		const u = dx * cos + dy * sin;
		const v = -dx * sin + dy * cos;
		return (u / rx) ** 2 + (v / ry) ** 2 <= 1;
	};
}

function arc(cx: number, cy: number, r: number, t: number) {
	return (x: number, y: number) =>
		Math.abs(Math.hypot(x - cx, y - cy) - r) <= t / 2 && y >= cy;
}

// iris: warm brown, lighter toward the bottom for a glossy look
function iris(_cx: number, cy: number) {
	return (_x: number, y: number) => {
		const k = Math.min(1, Math.max(0, (y - (cy - 2)) / 4));
		return mix([70, 48, 42], [120, 84, 66], k);
	};
}

function eye(cx: number, cy: number, dir: number): Layer[] {
	return [
		{t: ellipse(cx, cy, 2.1, 2.3), c: iris(cx, cy)},
		{t: ellipse(cx, cy, 1.15, 1.3), c: [8, 8, 10]},
		{t: ellipse(cx - 0.7 * dir, cy - 0.8, 0.7, 0.7), c: [255, 255, 255]},
		{t: ellipse(cx + 0.8 * dir, cy + 0.9, 0.35, 0.35), c: [235, 235, 245]},
	];
}

function ear(cx: number): Layer[] {
	return [
		{t: ellipse(cx, 7.3, 5.4, 5.4), c: [58, 58, 68]},
		{t: ellipse(cx, 7.7, 5.0, 5.0), c: INK},
		{t: ellipse(cx, 8.4, 2.9, 2.9), c: [74, 64, 74]},
		{t: ellipse(cx, 8.9, 1.7, 1.7), c: [48, 42, 50]},
	];
}

// ---------- panda (drawn back to front) ----------

const LAYERS: Layer[] = [
	...ear(8),
	...ear(28),
	// head with soft vertical shading
	{
		t: ellipse(18, 18, 14.5, 12.5),
		c: (_x, y) => {
			const k = Math.max(0, (y - 5.5) / 25);
			return [252 - 26 * k, 252 - 26 * k, 255 - 22 * k];
		},
	},
	// muzzle
	{t: ellipse(18, 23.2, 5.6, 3.8), c: [255, 255, 255], a: 0.55},
	// blush
	{t: ellipse(7.8, 23, 2.6, 1.8), c: [255, 165, 185], a: 0.45},
	{t: ellipse(28.2, 23, 2.6, 1.8), c: [255, 165, 185], a: 0.45},
	// eye patches (tilted)
	{t: ellipse(11.5, 18, 3.6, 5.6, 25), c: INK},
	{t: ellipse(24.5, 18, 3.6, 5.6, -25), c: INK},
	// eyes
	...eye(12.2, 17.8, 1),
	...eye(23.8, 17.8, -1),
	// nose + highlight
	{t: ellipse(18, 22.2, 2.7, 1.8), c: INK},
	{t: ellipse(17.0, 21.6, 1.0, 0.5), c: [110, 110, 122]},
	// mouth
	{
		t: (x, y) => Math.abs(x - 18) <= 0.3 && y >= 23.8 && y <= 25.2,
		c: [40, 40, 46],
	},
	{t: arc(16.6, 24.6, 1.5, 0.55), c: [40, 40, 46]},
	{t: arc(19.4, 24.6, 1.5, 0.55), c: [40, 40, 46]},
];

// ---------- rasterize ----------

const SUPERSAMPLES = 4;

/** Rasterised panda rows, cached per resolution scale. */
const pandaCache = new Map<number, string[]>();

function rasterizePanda(scale: number): string[] {
	const cached = pandaCache.get(scale);
	if (cached) return cached;

	const width = Math.round(36 * scale);
	// keep the row count even so every row pairs into one character cell
	const height = Math.round(32 * scale) & ~1;
	const pixels: (RGB | null)[][] = [];

	for (let y = 0; y < height; y++) {
		const row: (RGB | null)[] = [];
		for (let x = 0; x < width; x++) {
			let covered = 0;
			let r = 0;
			let g = 0;
			let b = 0;
			for (let sy = 0; sy < SUPERSAMPLES; sy++) {
				for (let sx = 0; sx < SUPERSAMPLES; sx++) {
					const designX = (x + (sx + 0.5) / SUPERSAMPLES) / scale;
					const designY = (y + (sy + 0.5) / SUPERSAMPLES) / scale;
					let color: RGB | null = null;
					for (const layer of LAYERS) {
						if (!layer.t(designX, designY)) continue;
						const fill =
							typeof layer.c === 'function'
								? layer.c(designX, designY)
								: layer.c;
						// Matches the reference exactly: an alpha layer blends over
						// what is already there and is skipped when nothing is, and
						// rounding happens only once, when the cell is averaged.
						if (layer.a !== undefined) {
							if (color !== null) {
								const k = layer.a;
								color = [
									color[0] * (1 - k) + fill[0] * k,
									color[1] * (1 - k) + fill[1] * k,
									color[2] * (1 - k) + fill[2] * k,
								];
							}
						} else {
							color = fill;
						}
					}
					if (color) {
						covered++;
						r += color[0];
						g += color[1];
						b += color[2];
					}
				}
			}
			row.push(
				covered / (SUPERSAMPLES * SUPERSAMPLES) >= 0.5
					? [
							Math.round(r / covered),
							Math.round(g / covered),
							Math.round(b / covered),
						]
					: null,
			);
		}
		pixels.push(row);
	}

	const rows = renderHalfBlocks(pixels, width, height);
	pandaCache.set(scale, rows);
	return rows;
}

/** Two pixel rows per terminal row, using `▀` as a split foreground/background. */
function renderHalfBlocks(
	pixels: (RGB | null)[][],
	width: number,
	height: number,
): string[] {
	const rows: string[] = [];
	for (let y = 0; y < height; y += 2) {
		let line = '';
		for (let x = 0; x < width; x++) {
			const top = pixels[y]?.[x];
			const bottom = pixels[y + 1]?.[x];
			if (top && bottom) line += fg(top) + bg(bottom) + '▀';
			else if (top) line += fg(top) + '▀';
			else if (bottom) line += fg(bottom) + '▄';
			else line += ' ';
			line += RESET;
		}
		rows.push(line);
	}
	return rows;
}

// ---------- wordmark (5x5 pixel font) ----------

const FONT: Record<string, string[]> = {
	B: ['####.', '#...#', '####.', '#...#', '####.'],
	A: ['.###.', '#...#', '#####', '#...#', '#...#'],
	Y: ['#...#', '.#.#.', '..#..', '..#..', '..#..'],
	P: ['####.', '#...#', '####.', '#....', '#....'],
	N: ['#...#', '##..#', '#.#.#', '#..##', '#...#'],
	D: ['####.', '#...#', '#...#', '#...#', '####.'],
};

const wordmarkCache = new Map<string, string[]>();

function word(text: string): string[] {
	const cached = wordmarkCache.get(text);
	if (cached) return cached;

	const width = text.length * 6 - 1;
	const pixels: (RGB | null)[][] = Array.from({length: 6}, () =>
		Array.from({length: width}, () => null),
	);
	for (const [index, character] of [...text].entries()) {
		const glyph = FONT[character];
		if (!glyph) continue;
		glyph.forEach((line, row) => {
			for (const [column, pixel] of [...line].entries()) {
				if (pixel !== '#') continue;
				const x = index * 6 + column;
				const shade = Math.round(255 - 70 * (x / width));
				pixels[row]![x] = [shade, shade, Math.min(255, shade + 8)];
			}
		});
	}

	const rows = renderHalfBlocks(pixels, width, 6);
	wordmarkCache.set(text, rows);
	return rows;
}

// ---------- compose ----------

/** Widest fixed line of the right-hand column (the rule under the wordmark). */
const RIGHT_COLUMN_WIDTH = 29;
/** Gap between the panda and the right column, plus the two leading spaces. */
const BANNER_CHROME_WIDTH = 5;

/**
 * Widest line the right-hand column will actually render. The session line is
 * `session ` plus the id, which for a 26-character ULID is wider than the rule,
 * so it — not the rule — decides whether the banner fits.
 */
function rightColumnWidth(sessionId: string): number {
	return Math.max(RIGHT_COLUMN_WIDTH, `session ${sessionId}`.length);
}

/** Full banner width at a given resolution scale. */
export function bannerWidth(scale: number, sessionId: string): number {
	return (
		Math.round(36 * scale) + BANNER_CHROME_WIDTH + rightColumnWidth(sessionId)
	);
}

/**
 * Resolution scale for a terminal width. The banner is dropped to a text-only
 * wordmark below the width even the smallest scale needs.
 */
export function bannerScale(columns: number, sessionId: string): number | null {
	if (columns >= bannerWidth(1.5, sessionId)) return 1.5;
	if (columns >= bannerWidth(1, sessionId)) return 1;
	return null;
}

function rightColumn(sessionId: string): string[] {
	return [
		...word('BABY'),
		...word('PANDA'),
		'',
		dim('─'.repeat(RIGHT_COLUMN_WIDTH)),
		dim('terminal coding agent'),
		`\x1b[38;2;120;220;160m●${RESET} ` + dim('v0.1.0 · ready'),
		dim(`session ${sessionId}`),
	];
}

/** Rows the text-only fallback occupies (see `pandaBannerRows`). */
const TEXT_FALLBACK_LINES = 5;

/**
 * One terminal row per line of the banner, ANSI included. Below the width the
 * smallest scale needs, the panda and the pixel wordmark are dropped for a
 * plain-text banner, since half-block art cannot be scaled down any further.
 */
export function pandaBannerRows(sessionId: string, columns: number): string[] {
	const scale = bannerScale(columns, sessionId);

	if (scale === null) {
		return [
			dim('BABY PANDA'),
			dim('─'.repeat(RIGHT_COLUMN_WIDTH)),
			dim('terminal coding agent'),
			`\x1b[38;2;120;220;160m●${RESET} ` + dim('v0.1.0 · ready'),
			dim(`session ${sessionId}`),
		];
	}

	const right = rightColumn(sessionId);
	const panda = rasterizePanda(scale);
	const offset = Math.floor((panda.length - right.length) / 2);
	return panda.map(
		(line, index) => `  ${line}   ${right[index - offset] ?? ''}`,
	);
}

/** Terminal rows the banner occupies at this width. */
export function pandaBannerHeight(sessionId: string, columns: number): number {
	const scale = bannerScale(columns, sessionId);
	if (scale === null) return TEXT_FALLBACK_LINES;
	return Math.round(32 * scale) / 2;
}
