import {describe, expect, test} from 'bun:test';
import {buildToolCallLayout} from './toolCallLayout';
import type {ToolCallBatch, ToolCallEntry} from '../types';

const LAYOUT_OPTIONS = {
	chatHeight: 30,
	width: 80,
	isCommandExpanded: () => false,
};

function layoutFor(
	calls: ToolCallEntry[],
	{expanded, diffExpanded}: {expanded: boolean; diffExpanded: boolean},
) {
	const batch: ToolCallBatch = {id: 'batch-1', createdAt: 0, calls};
	return buildToolCallLayout(batch, {
		...LAYOUT_OPTIONS,
		expanded,
		isDiffExpanded: () => diffExpanded,
	});
}

function diffRows(layout: ReturnType<typeof layoutFor>) {
	return layout.rows.filter(row => row.type === 'diff');
}

const editCall: ToolCallEntry = {
	id: 'call-1',
	name: 'edit',
	arguments: {path: 'src/example.ts', old_str: 'two', new_str: 'TWO'},
	status: 'done',
	before: 'one\ntwo\nthree\n',
	stats: {added: 1, removed: 1},
};

describe('collapsed diff viewers', () => {
	test('report the real added/removed counts, not zeros', () => {
		const rows = diffRows(
			layoutFor([editCall], {expanded: true, diffExpanded: false}),
		);
		expect(rows).toHaveLength(1);
		expect(rows[0]!.diff.added).toBe(1);
		expect(rows[0]!.diff.removed).toBe(1);
	});

	test('match the counts of the expanded viewer', () => {
		const collapsed = diffRows(
			layoutFor([editCall], {expanded: true, diffExpanded: false}),
		)[0]!.diff;
		const expanded = diffRows(
			layoutFor([editCall], {expanded: true, diffExpanded: true}),
		)[0]!.diff;
		expect(collapsed.added).toBe(expanded.added);
		expect(collapsed.removed).toBe(expanded.removed);
	});

	test('build no rows until the viewer is expanded', () => {
		const collapsed = diffRows(
			layoutFor([editCall], {expanded: true, diffExpanded: false}),
		)[0]!.diff;
		const expanded = diffRows(
			layoutFor([editCall], {expanded: true, diffExpanded: true}),
		)[0]!.diff;
		expect(collapsed.rows).toHaveLength(0);
		expect(expanded.rows.length).toBeGreaterThan(0);
	});

	test('a collapsed group renders no diff rows at all', () => {
		const layout = layoutFor([editCall], {
			expanded: false,
			diffExpanded: false,
		});
		expect(diffRows(layout)).toHaveLength(0);
		expect(layout.rows.map(row => row.type)).toEqual(['header', 'bullet']);
	});
});

describe('countDiffChanges', () => {
	test('agrees with buildSideBySide for a multi-line replacement', async () => {
		const {buildSideBySide, countDiffChanges} = await import('./diffRows');
		const before = 'a\nb\nc\nd\n';
		const after = 'a\nb\nB\nC\nc\nd\n';
		const counts = countDiffChanges(before, after);
		const full = buildSideBySide(before, after);
		expect(counts).toEqual({added: full.added, removed: full.removed});
		expect(counts).toEqual({added: 2, removed: 0});
	});

	test('counts a pure deletion', async () => {
		const {countDiffChanges} = await import('./diffRows');
		expect(countDiffChanges('w\nx\ny\nz\n', 'w\nz\n')).toEqual({
			added: 0,
			removed: 2,
		});
	});

	test('counts a new file as all additions', async () => {
		const {countDiffChanges} = await import('./diffRows');
		expect(countDiffChanges('', 'l1\nl2\n')).toEqual({added: 2, removed: 0});
	});
});
