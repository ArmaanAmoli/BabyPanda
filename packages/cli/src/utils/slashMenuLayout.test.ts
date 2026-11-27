import {describe, expect, test} from 'bun:test';
import {
	buildSlashMenuLayout,
	getSlashMenuHeight,
	padEndToWidth,
	resolveNameColumnWidth,
	truncateToWidth,
	type SlashMenuEntry,
} from './slashMenuLayout';

function entry(name: string, description = 'a description'): SlashMenuEntry {
	return {name, description, value: `command:${name}`};
}

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
		const width = resolveNameColumnWidth([entry('a'.repeat(60))], 200);
		expect(width).toBe(26);
	});

	test('gives the description its share on a narrow terminal', () => {
		// A 30-character name would want 32 columns; 40 columns only leave the
		// description 16, so the name column is capped at 24 instead.
		expect(resolveNameColumnWidth([entry('a'.repeat(30))], 40)).toBe(24);
		expect(resolveNameColumnWidth([entry('a'.repeat(30))], 24)).toBe(14);
	});

	test('still leaves the name column at least one column', () => {
		expect(resolveNameColumnWidth([entry('model')], 1)).toBe(1);
	});
});

describe('buildSlashMenuLayout', () => {
	const entries = [
		entry('model', 'switch model'),
		entry('web-api-keys', 'add or change the Exa key for web search'),
	];

	test('every row is cut to the available width', () => {
		const {rows} = buildSlashMenuLayout(entries, 40);
		for (const row of rows) {
			expect(row.name.length + row.description.length).toBeLessThanOrEqual(40);
		}
	});

	test('descriptions start at the same column on every row', () => {
		const {rows, nameWidth} = buildSlashMenuLayout(entries, 60);
		for (const row of rows) {
			expect(padEndToWidth(row.name, nameWidth)).toHaveLength(nameWidth);
		}
	});

	test('a long description is the one that gets cut', () => {
		const {rows} = buildSlashMenuLayout(entries, 40);
		expect(rows[0]!.description).toBe('switch model');
		expect(rows[1]!.description.endsWith('…')).toBe(true);
	});

	test('the value survives the layout untouched', () => {
		const {rows} = buildSlashMenuLayout(entries, 80);
		expect(rows.map(row => row.value)).toEqual([
			'command:model',
			'command:web-api-keys',
		]);
	});
});

describe('getSlashMenuHeight', () => {
	test('one row per entry while they all fit', () => {
		expect(getSlashMenuHeight(6, 20)).toBe(6);
	});

	test('the limit wins when there are more entries than rows', () => {
		expect(getSlashMenuHeight(40, 12)).toBe(12);
	});

	test('an empty menu takes no rows at all', () => {
		expect(getSlashMenuHeight(0, 12)).toBe(0);
	});
});
