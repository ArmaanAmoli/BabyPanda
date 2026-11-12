import {describe, expect, test} from 'bun:test';
import {buildToolCallLayout, rowSpanAtLine} from './toolCallLayout';
import type {ToolCallBatch, ToolCallEntry} from '../types';

const LAYOUT_OPTIONS = {
	chatHeight: 30,
	width: 80,
	isCommandExpanded: () => false,
};

function layoutFor(
	calls: ToolCallEntry[],
	{
		expanded,
		diffExpanded,
	}: {
		expanded: boolean;
		diffExpanded: boolean | ((callId: string) => boolean);
	},
) {
	const batch: ToolCallBatch = {id: 'batch-1', createdAt: 0, calls};
	return buildToolCallLayout(batch, {
		...LAYOUT_OPTIONS,
		expanded,
		isDiffExpanded:
			typeof diffExpanded === 'function' ? diffExpanded : () => diffExpanded,
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

/**
 * Reproduces the reported click bug: a terminal row is a *content line*, but
 * an expanded diff row spans many lines, so the line cannot index `rows`
 * directly. Clicking the top diff first used to shift every row below it and
 * make their clicks land on the wrong row (or none at all).
 */
describe('clicking diff viewers', () => {
	const threeEdits: ToolCallEntry[] = ['a', 'b', 'c'].map((suffix, index) => ({
		id: `call-${suffix}`,
		name: 'edit',
		arguments: {path: `src/f${suffix}.ts`, old_str: 'two', new_str: 'TWO'},
		status: 'done',
		before: `one${index}\ntwo\nthree\n`,
		stats: {added: 1, removed: 1},
	}));

	/** Row index of the diff viewer for a call id. */
	function diffRowIndex(layout: ReturnType<typeof layoutFor>, callId: string) {
		return layout.rows.findIndex(
			row => row.type === 'diff' && row.call.id === callId,
		);
	}

	test('every diff header still maps to its own row once one is expanded', () => {
		const layout = layoutFor(threeEdits, {
			expanded: true,
			diffExpanded: id => id === 'call-a',
		});
		// the expanded viewer really does push the rows below it down
		expect(layout.expandedFullHeight).toBeGreaterThan(layout.rows.length);

		for (const callId of ['call-a', 'call-b', 'call-c']) {
			const index = diffRowIndex(layout, callId);
			const span = layout.rowSpans[index]!;
			expect(rowSpanAtLine(layout.rowSpans, span.start)?.index).toBe(index);
			// the last line of the viewer belongs to it too
			expect(
				rowSpanAtLine(layout.rowSpans, span.start + span.lines - 1)?.index,
			).toBe(index);
		}
	});

	test('the naive line-as-index mapping is what broke', () => {
		const layout = layoutFor(threeEdits, {
			expanded: true,
			diffExpanded: id => id === 'call-a',
		});
		const indexB = diffRowIndex(layout, 'call-b');
		const startB = layout.rowSpans[indexB]!.start;
		// what the component used to do: index `rows` with a content line
		expect(layout.rows[startB]).toBeUndefined();
		expect(rowSpanAtLine(layout.rowSpans, startB)?.index).toBe(indexB);
	});

	test('expanding the last viewer leaves the rows above it untouched', () => {
		const layout = layoutFor(threeEdits, {
			expanded: true,
			diffExpanded: id => id === 'call-c',
		});
		// rows above the expanded viewer keep their original line offsets,
		// which is why clicking upwards from the bottom used to work
		for (const callId of ['call-a', 'call-b', 'call-c']) {
			const index = diffRowIndex(layout, callId);
			expect(layout.rowSpans[index]!.start).toBe(index);
		}
		const indexC = diffRowIndex(layout, 'call-c');
		expect(layout.rowSpans[indexC]!.lines).toBeGreaterThan(1);
	});

	test('spans stay consistent with the reported heights', () => {
		const layout = layoutFor(threeEdits, {
			expanded: true,
			diffExpanded: id => id === 'call-a',
		});
		const total = layout.rowSpans.reduce((sum, span) => sum + span.lines, 0);
		expect(total).toBe(layout.expandedFullHeight);
		// spans are contiguous and start at the first content line
		expect(layout.rowSpans[0]!.start).toBe(0);
		for (const [index, span] of layout.rowSpans.entries()) {
			expect(span.index).toBe(index);
			if (index > 0) {
				expect(span.start).toBe(
					layout.rowSpans[index - 1]!.start + layout.rowSpans[index - 1]!.lines,
				);
			}
		}
	});

	test('a collapsed group maps every line to its own single-line row', () => {
		const layout = layoutFor(threeEdits, {
			expanded: false,
			diffExpanded: false,
		});
		for (const [index] of layout.rows.entries()) {
			expect(rowSpanAtLine(layout.rowSpans, index)?.index).toBe(index);
		}
		expect(rowSpanAtLine(layout.rowSpans, layout.rows.length)).toBeUndefined();
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
