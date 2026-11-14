import {describe, expect, test} from 'bun:test';
import {createHash} from 'crypto';
import {
	bannerScale,
	bannerWidth,
	pandaBannerHeight,
	pandaBannerRows,
} from './pandaBanner';

const SESSION = '01J9Z8KQ7V3M2N4P6R8T0WXYZ1';

/** Visible width of a row, ignoring ANSI escapes. */
function visibleWidth(row: string): number {
	// the escape byte is a control character by nature, so the rule is a
	// false positive here: matching SGR sequences is exactly the point
	// eslint-disable-next-line no-control-regex
	return row.replace(/\x1b\[[0-9;]*m/g, '').length;
}

function checksum(rows: string[]): string {
	return createHash('sha256')
		.update(rows.join('\n'))
		.digest('hex')
		.slice(0, 16);
}

describe('panda banner', () => {
	test('renders 24 rows at full scale and 16 at the reduced scale', () => {
		expect(pandaBannerRows(SESSION, 200)).toHaveLength(24);
		expect(pandaBannerRows(SESSION, 80)).toHaveLength(16);
	});

	test('every row fits the terminal width it was rendered for', () => {
		for (const columns of [200, 120, 88, 80, 70]) {
			for (const row of pandaBannerRows(SESSION, columns)) {
				expect(visibleWidth(row)).toBeLessThanOrEqual(columns);
			}
		}
	});

	test('the session id is the last line of the right-hand column', () => {
		const rows = pandaBannerRows(SESSION, 200);
		const sessionRow = rows.findIndex(row =>
			row.includes(`session ${SESSION}`),
		);
		expect(sessionRow).toBeGreaterThanOrEqual(0);
		// nothing from the right-hand column follows it: the rows below are
		// panda art only, which is what "at the end of the banner" means here
		const trailing = rows.slice(sessionRow + 1).join('');
		for (const marker of [
			'ready',
			'terminal coding agent',
			'v0.1.0',
			'BABY',
			'PANDA',
		]) {
			expect(trailing).not.toContain(marker);
		}
		// and it is the only line carrying the session id
		expect(rows.filter(row => row.includes(`session ${SESSION}`))).toHaveLength(
			1,
		);
	});

	test('a different session id changes only that line', () => {
		const a = pandaBannerRows('SESSIONAAA', 200);
		const b = pandaBannerRows('SESSIONBBB', 200);
		expect(a).toHaveLength(b.length);
		const changed = a.filter((row, index) => row !== b[index]);
		expect(changed).toHaveLength(1);
		// `changed` comes from `a`, so it carries the first id; `b` carries the second
		expect(changed[0]).toContain('SESSIONAAA');
		expect(b.find(row => row.includes('session'))).toContain('SESSIONBBB');
	});

	test('scale steps down with the terminal and drops when too narrow', () => {
		// the 26-character ULID makes the session line the widest right-column
		// line, so it — not the 29-character rule — sets the required width
		expect(bannerWidth(1.5, SESSION)).toBe(93);
		expect(bannerWidth(1, SESSION)).toBe(75);
		expect(bannerScale(200, SESSION)).toBe(1.5);
		expect(bannerScale(93, SESSION)).toBe(1.5);
		expect(bannerScale(92, SESSION)).toBe(1);
		expect(bannerScale(75, SESSION)).toBe(1);
		expect(bannerScale(74, SESSION)).toBeNull();
	});

	test('a short session id lets the full scale fit a narrower terminal', () => {
		expect(bannerWidth(1.5, 'abc')).toBe(88);
		expect(bannerScale(88, 'abc')).toBe(1.5);
		expect(bannerScale(87, 'abc')).toBe(1);
	});

	test('falls back to a text-only wordmark when too narrow', () => {
		const rows = pandaBannerRows(SESSION, 60);
		expect(rows.length).toBeGreaterThan(0);
		// no half-block art survives the fallback
		expect(rows.join('')).not.toContain('▀');
		expect(rows.join('')).not.toContain('▄');
		for (const row of rows) {
			expect(visibleWidth(row)).toBeLessThanOrEqual(60);
		}
	});

	test('height matches the rendered row count', () => {
		expect(pandaBannerHeight(SESSION, 200)).toBe(
			pandaBannerRows(SESSION, 200).length,
		);
		expect(pandaBannerHeight(SESSION, 80)).toBe(
			pandaBannerRows(SESSION, 80).length,
		);
		expect(pandaBannerHeight(SESSION, 60)).toBe(
			pandaBannerRows(SESSION, 60).length,
		);
	});

	test('the raster is cached, so repeated calls are identical', () => {
		const first = pandaBannerRows(SESSION, 200);
		const second = pandaBannerRows(SESSION, 200);
		expect(second).toEqual(first);
		expect(checksum(second)).toBe(checksum(first));
	});

	/*
	 * Drift guard: these digests pin the exact rasterised output against the
	 * reference implementation in docs/panda-banner.js. Any change to the
	 * shapes, the supersampling, the half-block renderer or the wordmark font
	 * breaks them, which is the point -- the artwork is not supposed to move.
	 */
	test('the rasterised artwork has not drifted from the reference', () => {
		expect(checksum(pandaBannerRows(SESSION, 200))).toBe('ac2089222d1afb81');
		expect(checksum(pandaBannerRows(SESSION, 80))).toBe('c69ea55c35c30ece');
	});
});
