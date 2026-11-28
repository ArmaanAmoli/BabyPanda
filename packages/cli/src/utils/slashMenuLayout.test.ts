import {describe, expect, test} from 'bun:test';
import {
	buildSlashMenuLayout,
	getSlashMenuHeight,
	padEndToWidth,
	resolveNameColumnWidth,
	resolveSlashMenuWindow,
	truncateToWidth,
	type SlashMenuEntry,
} from './slashMenuLayout';

function entry(name: string, description = 'a description'): SlashMenuEntry {
	return {name, description, value: `command:${name}`};
}

const LONG =
	'You MUST use this before any creative work — creating features, building components, adding functionality.';

describe('truncateToWidth', () => {
	test('leaves text that already fits untouched', () => {
		expect(truncateToWidth('/model', 10)).toBe('/model');
	});

	test('cuts an over-long string and marks the cut', () => {
		const cut = truncateToWidth('switch model', 8);
		expect(cut).toBe('switch …');
		expect(cut).toHaveLength(8);
	});

	test('measures columns, not characters', () => {
		// '好' is two columns wide, so two of them fill four columns and a
		// third does not fit beside an ellipsis in a five-column row.
		expect(truncateToWidth('好好好', 5)).toBe('好好…');
	});

	test('never returns more columns than it was given', () => {
		for (const width of [1, 2, 3]) {
			expect(truncateToWidth('description', width).length).toBeLessThanOrEqual(
				width,
			);
		}
	});

	test('a zero or negative width is an empty row', () => {
		expect(truncateToWidth('anything', 0)).toBe('');
		expect(truncateToWidth('anything', -3)).toBe('');
	});
});

describe('padEndToWidth', () => {
	test('pads to the exact column count', () => {
		expect(padEndToWidth('/model', 8)).toBe('/model  ');
	});

	test('a string already at the width is returned as is', () => {
		expect(padEndToWidth('/model', 6)).toBe('/model');
	});

	test('a wide character counts for the columns it occupies', () => {
		expect(padEndToWidth('好', 4)).toBe('好  ');
	});
});

describe('resolveNameColumnWidth', () => {
	test('fits the longest name plus its gap', () => {
		expect(
			resolveNameColumnWidth([entry('model'), entry('web-api-keys')], 100),
		).toBe('web-api-keys'.length + 2);
	});

	test('never grows past the cap, however long the names are', () => {
		// The cap applies to the name itself; the gap is added on top, so a
		// capped name still has air between it and the description.
		const width = resolveNameColumnWidth([entry('a'.repeat(60))], 200);
		expect(width).toBe(26 + 2);
	});

	test('a name that exactly fills the cap still keeps its gap', () => {
		const width = resolveNameColumnWidth([entry('a'.repeat(26))], 200);
		expect(width).toBe(28);
	});

	test('gives the description its share on a narrow terminal', () => {
		// A 30-character name would want 32 columns; 40 columns only leave the
		// description 20, so the name column is capped at 20 instead.
		expect(resolveNameColumnWidth([entry('a'.repeat(30))], 40)).toBe(20);
		expect(resolveNameColumnWidth([entry('a'.repeat(30))], 24)).toBe(12);
	});

	test('still leaves the name column room for one character', () => {
		// Even with no width to spare the column keeps one character plus the
		// gap, so the name never collides with the description.
		expect(resolveNameColumnWidth([entry('model')], 1)).toBe(3 + 2);
	});
});

describe('buildSlashMenuLayout', () => {
	const entries = [
		entry('model', 'switch model'),
		entry('web-api-keys', 'add or change the Exa key for web search'),
	];

	test('a description that fits stays on one line', () => {
		const {rows} = buildSlashMenuLayout(entries, 80);
		expect(rows[0]!.descriptionLines).toEqual(['switch model']);
	});

	test('a description that does not fit wraps instead of being cut', () => {
		const {rows, nameWidth} = buildSlashMenuLayout(entries, 40);
		const lines = rows[1]!.descriptionLines;

		expect(lines.length).toBeGreaterThan(1);
		// Nothing is dropped: the whole sentence is still there, just spread
		// over several rows. Wrapping breaks after a space, so the join has to
		// collapse the run it leaves behind.
		expect(lines.join(' ').replace(/\s+/g, ' ')).toContain(
			'add or change the Exa key for web search',
		);
		for (const line of lines) {
			expect(line.length).toBeLessThanOrEqual(40 - nameWidth);
		}
	});

	test('every row of an entry is inside the terminal width', () => {
		const {rows, nameWidth} = buildSlashMenuLayout(entries, 40);
		for (const row of rows) {
			for (const line of row.descriptionLines) {
				expect(nameWidth + line.length).toBeLessThanOrEqual(40);
			}
		}
	});

	test('descriptions start at the same column on every entry', () => {
		const {rows, nameWidth} = buildSlashMenuLayout(entries, 60);
		for (const row of rows) {
			expect(padEndToWidth(row.name, nameWidth)).toHaveLength(nameWidth);
		}
	});

	test('the value survives the layout untouched', () => {
		const {rows} = buildSlashMenuLayout(entries, 80);
		expect(rows.map(row => row.value)).toEqual([
			'command:model',
			'command:web-api-keys',
		]);
	});

	test('an entry with no description still owns its row', () => {
		const {rows, rowHeights} = buildSlashMenuLayout([entry('model', '')], 80);
		expect(rows[0]!.descriptionLines).toEqual(['']);
		expect(rowHeights).toEqual([1]);
	});

	test('row heights count the wrapped lines', () => {
		const {rowHeights} = buildSlashMenuLayout(
			[entry('model', 'switch model'), entry('advisor', LONG)],
			40,
		);
		expect(rowHeights[0]).toBe(1);
		expect(rowHeights[1]).toBeGreaterThan(1);
	});
});

describe('getSlashMenuHeight', () => {
	test('one row per entry while every description fits', () => {
		expect(getSlashMenuHeight([entry('model', 'switch model')], 80, 20)).toBe(
			1,
		);
	});

	test('counts the wrapped lines, not the entries', () => {
		const height = getSlashMenuHeight([entry('advisor', LONG)], 40, 20);
		expect(height).toBeGreaterThan(1);
	});

	test('the limit wins when the list is taller than the budget', () => {
		expect(getSlashMenuHeight([entry('advisor', LONG)], 40, 2)).toBe(2);
	});

	test('an empty menu takes no rows at all', () => {
		expect(getSlashMenuHeight([], 80, 12)).toBe(0);
	});
});

describe('resolveSlashMenuWindow', () => {
	const heights = [1, 3, 1, 2];

	test('shows everything while it all fits', () => {
		expect(resolveSlashMenuWindow(heights, 0, 10)).toEqual({start: 0, end: 4});
	});

	test('keeps the selected entry inside the window', () => {
		const window = resolveSlashMenuWindow(heights, 3, 4);
		expect(window.start).toBeLessThanOrEqual(3);
		expect(window.end).toBeGreaterThan(3);
	});

	test('never spends more than the budget', () => {
		for (let index = 0; index < heights.length; index++) {
			const window = resolveSlashMenuWindow(heights, index, 4);
			const used = heights
				.slice(window.start, window.end)
				.reduce((a, b) => a + b, 0);
			expect(used).toBeLessThanOrEqual(4);
		}
	});

	test('a window that cannot hold the selected entry still shows it', () => {
		expect(resolveSlashMenuWindow(heights, 1, 1)).toEqual({start: 1, end: 2});
	});

	test('an empty list or a zero budget shows nothing', () => {
		expect(resolveSlashMenuWindow([], 0, 10)).toEqual({start: 0, end: 0});
		expect(resolveSlashMenuWindow(heights, 0, 0)).toEqual({start: 0, end: 0});
	});
});
