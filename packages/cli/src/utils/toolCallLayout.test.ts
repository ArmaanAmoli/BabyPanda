import {describe, expect, test} from 'bun:test';
import {
	buildToolCallLayout,
	resolveRowClick,
	rowSpanAtLine,
} from './toolCallLayout';
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
	test('render only the grey bullet with the real added/removed counts', () => {
		const layout = layoutFor([editCall], {
			expanded: true,
			diffExpanded: false,
		});
		expect(diffRows(layout)).toHaveLength(0);
		expect(layout.rows.map(row => row.type)).toEqual(['bullet']);
		expect(layout.bullets[0]?.diffStats).toEqual({added: 1, removed: 1});
	});

	test('bullet counts match the expanded viewer', () => {
		const collapsed = layoutFor([editCall], {
			expanded: true,
			diffExpanded: false,
		});
		const expanded = diffRows(
			layoutFor([editCall], {expanded: true, diffExpanded: true}),
		)[0]!.diff;
		expect(collapsed.bullets[0]?.diffStats).toEqual({
			added: expanded.added,
			removed: expanded.removed,
		});
	});

	test('build no diff row until the viewer is expanded', () => {
		const collapsed = layoutFor([editCall], {
			expanded: true,
			diffExpanded: false,
		});
		const expanded = diffRows(
			layoutFor([editCall], {expanded: true, diffExpanded: true}),
		)[0]!.diff;
		expect(diffRows(collapsed)).toHaveLength(0);
		expect(expanded.rows.length).toBeGreaterThan(0);
	});

	test('a collapsed group renders no diff rows at all', () => {
		const single = layoutFor([editCall], {
			expanded: false,
			diffExpanded: false,
		});
		expect(diffRows(single)).toHaveLength(0);
		// a single call flattens to a lone bullet; there is no header row
		expect(single.hasRoot).toBe(false);
		expect(single.rows.map(row => row.type)).toEqual(['bullet']);

		const second: ToolCallEntry = {
			...editCall,
			id: 'call-2',
			arguments: {path: 'src/other.ts', old_str: 'two', new_str: 'TWO'},
		};
		const group = layoutFor([editCall, second], {
			expanded: false,
			diffExpanded: false,
		});
		expect(diffRows(group)).toHaveLength(0);
		// a multi-call batch folds away to just its root line
		expect(group.hasRoot).toBe(true);
		expect(group.rows.map(row => row.type)).toEqual(['root']);
	});
});

describe('batch root', () => {
	test('a single call never renders a root, however many bullets it makes', () => {
		const multiUrl: ToolCallEntry = {
			id: 'web-1',
			name: 'get_web_page',
			arguments: {url: ['https://a.example', 'https://b.example']},
			status: 'done',
		};
		const layout = layoutFor([multiUrl], {expanded: true, diffExpanded: false});
		// one call, several bullets — and still no `■ 1 tool` root line
		expect(layout.bullets.length).toBeGreaterThan(1);
		expect(layout.hasRoot).toBe(false);
		expect(layout.rows.map(row => row.type)).toEqual(['bullet', 'bullet']);
	});

	test('a multi-call batch renders its root above the bullets', () => {
		const calls: ToolCallEntry[] = ['a', 'b', 'c'].map(suffix => ({
			id: `call-${suffix}`,
			name: 'edit',
			arguments: {path: `src/f${suffix}.ts`, old_str: 'two', new_str: 'TWO'},
			status: 'done',
			before: 'one\ntwo\nthree\n',
			stats: {added: 1, removed: 1},
		}));
		const layout = layoutFor(calls, {expanded: true, diffExpanded: false});
		expect(layout.hasRoot).toBe(true);
		expect(layout.rows[0]!.type).toBe('root');
		// Collapsed edit bullets have no secondary path/summary rows.
		expect(layout.rows.slice(1).map(row => row.type)).toEqual([
			'bullet',
			'bullet',
			'bullet',
		]);
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

	test('every diff span still maps to its own row once one is expanded', () => {
		const layout = layoutFor(threeEdits, {
			expanded: true,
			diffExpanded: true,
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
			diffExpanded: true,
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
		// Bullets above the expanded viewer keep their original line offsets.
		for (const span of layout.rowSpans) {
			if (span.row.type === 'bullet') expect(span.start).toBe(span.index);
		}
		const indexC = diffRowIndex(layout, 'call-c');
		expect(indexC).toBeGreaterThanOrEqual(0);
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

describe('resolveRowClick', () => {
	const threeEdits: ToolCallEntry[] = ['a', 'b', 'c'].map((suffix, index) => ({
		id: `call-${suffix}`,
		name: 'edit',
		arguments: {path: `src/f${suffix}.ts`, old_str: 'two', new_str: 'TWO'},
		status: 'done',
		before: `one${index}\ntwo\nthree\n`,
		stats: {added: 1, removed: 1},
	}));

	function spanOf(
		layout: ReturnType<typeof layoutFor>,
		predicate: (row: (typeof layout.rows)[number]) => boolean,
	) {
		const index = layout.rows.findIndex(predicate);
		return layout.rowSpans[index];
	}

	/** Click every content line and collect the resulting actions. */
	function clickEveryLine(layout: ReturnType<typeof layoutFor>) {
		return layout.rowSpans.flatMap(span =>
			Array.from({length: span.lines}, (_, offset) => ({
				line: span.start + offset,
				action: resolveRowClick(span, span.start + offset, layout.hasRoot),
			})),
		);
	}

	test('expanded diff body rows are inert without a duplicate header', () => {
		const layout = layoutFor(threeEdits, {
			expanded: true,
			diffExpanded: id => id === 'call-a',
		});
		const span = spanOf(
			layout,
			row => row.type === 'diff' && row.call.id === 'call-a',
		)!;
		expect(span.lines).toBeGreaterThan(1);

		const clicks = clickEveryLine(layout).filter(
			click => click.line >= span.start && click.line < span.start + span.lines,
		);
		// The bullet toggles the expanded diff; every source row is inert.
		for (const click of clicks) {
			expect(click.action).toEqual({type: 'ignore'});
		}
	});

	test('a collapsed viewer has no row; its grey bullet is the only toggle', () => {
		const layout = layoutFor(threeEdits, {
			expanded: true,
			diffExpanded: false,
		});
		expect(
			spanOf(layout, row => row.type === 'diff' && row.call.id === 'call-b'),
		).toBeUndefined();
		const bullet = spanOf(
			layout,
			row => row.type === 'bullet' && row.bullet.key === 'call-b',
		)!;
		expect(resolveRowClick(bullet, bullet.start, layout.hasRoot)).toEqual({
			type: 'toggleDiff',
			callId: 'call-b',
		});
	});

	test('the bullet still toggles its diff', () => {
		const layout = layoutFor(threeEdits, {
			expanded: true,
			diffExpanded: false,
		});
		const span = spanOf(layout, row => row.type === 'bullet')!;
		expect(resolveRowClick(span, span.start, layout.hasRoot)).toEqual({
			type: 'toggleDiff',
			callId: 'call-a',
		});
	});

	test('the root line toggles the group, collapsed or expanded', () => {
		const many: ToolCallEntry[] = Array.from({length: 5}, (_, index) => ({
			...threeEdits[0]!,
			id: `call-${index}`,
			arguments: {path: `src/f${index}.ts`, old_str: 'two', new_str: 'TWO'},
		}));
		const expanded = layoutFor(many, {expanded: true, diffExpanded: false});
		const root = spanOf(expanded, row => row.type === 'root')!;
		expect(resolveRowClick(root, root.start, expanded.hasRoot)).toEqual({
			type: 'toggleGroup',
		});

		// collapsed, the root is the only row and still folds/unfolds
		const collapsed = layoutFor(many, {expanded: false, diffExpanded: false});
		expect(collapsed.rows.map(row => row.type)).toEqual(['root']);
		const collapsedRoot = spanOf(collapsed, row => row.type === 'root')!;
		expect(
			resolveRowClick(collapsedRoot, collapsedRoot.start, collapsed.hasRoot),
		).toEqual({type: 'toggleGroup'});
	});

	test('a shell bullet toggles its command', () => {
		const shell: ToolCallEntry[] = [
			{
				id: 'sh1',
				name: 'shell',
				arguments: {command: 'echo hello'},
				status: 'done',
			},
		];
		const layout = layoutFor(shell, {expanded: true, diffExpanded: false});
		const span = spanOf(layout, row => row.type === 'bullet')!;
		expect(resolveRowClick(span, span.start, layout.hasRoot)).toEqual({
			type: 'toggleCommand',
			key: 'sh1',
		});
	});

	test('a click past the last row is ignored', () => {
		const layout = layoutFor(threeEdits, {
			expanded: true,
			diffExpanded: false,
		});
		expect(resolveRowClick(undefined, 0, layout.hasRoot)).toEqual({
			type: 'ignore',
		});
		expect(
			resolveRowClick(
				undefined,
				layout.expandedFullHeight + 10,
				layout.hasRoot,
			),
		).toEqual({type: 'ignore'});
	});
});

describe('countDiffChanges', () => {
	test('agrees with buildUnifiedDiff for a multi-line replacement', async () => {
		const {buildUnifiedDiff, countDiffChanges} = await import('./diffRows');
		const before = 'a\nb\nc\nd\n';
		const after = 'a\nb\nB\nC\nc\nd\n';
		const counts = countDiffChanges(before, after);
		const full = buildUnifiedDiff(before, after);
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
