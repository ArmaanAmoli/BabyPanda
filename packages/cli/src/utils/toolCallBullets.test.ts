import {describe, expect, test} from 'bun:test';
import {buildBullets} from './toolCallBullets';
import {buildToolCallLayout} from './toolCallLayout';
import type {ToolCallBatch, ToolCallEntry} from '../types';

function editCall(
	id: string,
	before: string,
	args: Record<string, unknown>,
	overrides: Partial<ToolCallEntry> = {},
): ToolCallEntry {
	return {
		id,
		name: 'edit',
		arguments: {path: 'src/example.ts', ...args},
		status: 'done',
		before,
		// deliberately wrong: the agent's approximation, which the bullet must
		// no longer trust
		stats: {added: 99, removed: 99},
		...overrides,
	};
}

function bulletStats(calls: ToolCallEntry[]): string | undefined {
	return buildBullets(calls)[0]?.stats;
}

/** Real added/removed for one call, from the diff viewer's own data. */
function diffCounts(call: ToolCallEntry): {added: number; removed: number} {
	const batch: ToolCallBatch = {id: 'b', createdAt: 0, calls: [call]};
	const layout = buildToolCallLayout(batch, {
		expanded: true,
		isDiffExpanded: () => false,
		isCommandExpanded: () => false,
		chatHeight: 30,
		width: 80,
	});
	const row = layout.rows.find(row => row.type === 'diff');
	if (row?.type !== 'diff') throw new Error('expected a diff row');
	return {added: row.diff.added, removed: row.diff.removed};
}

describe('edit bullet stats', () => {
	test('report the real diff counts, not the raw old_str/new_str line counts', () => {
		// old_str/new_str carry context lines, so counting their lines
		// over-reports: the file only gains two lines.
		const call = editCall('e1', 'a\nb\nc\nd\n', {
			old_str: 'b\nc',
			new_str: 'b\nB\nC\nc',
		});
		const {added, removed} = diffCounts(call);
		expect({added, removed}).toEqual({added: 2, removed: 0});
		expect(bulletStats([call])).toBe('· +2 −0');
	});

	test('agree with the diff viewer for every kind of edit', () => {
		const cases: {before: string; oldStr: string; newStr: string}[] = [
			{
				before: 'const x = 1;\nconst y = 2;\n',
				oldStr: 'const x = 1;',
				newStr: 'const x = 2;',
			},
			{before: 'a\nb\nc\nd\n', oldStr: 'b\nc', newStr: 'b\nB\nC\nc'},
			{before: 'keep\n', oldStr: 'keep', newStr: 'keep\nnew'},
			{before: 'w\nx\ny\nz\n', oldStr: 'x\ny\n', newStr: ''},
			{
				before: 'alpha\nbeta\ngamma\n',
				oldStr: 'eta\ngamma',
				newStr: 'ETA\ngamma',
			},
			{before: 'same\n', oldStr: 'same', newStr: 'same'},
			{before: 'one\r\ntwo\r\nthree\r\n', oldStr: 'two', newStr: 'TWO'},
		];
		for (const [index, {before, oldStr, newStr}] of cases.entries()) {
			const call = editCall(`agree-${index}`, before, {
				old_str: oldStr,
				new_str: newStr,
			});
			const {added, removed} = diffCounts(call);
			expect(bulletStats([call])).toBe(`· +${added} −${removed}`);
		}
	});

	test('two edits to one file are two bullets with their own stats', () => {
		const v0 = 'a\nb\nc\nd\n';
		const v1 = v0.replace('b\nc', 'b\nB\nC\nc');
		const first = editCall('m1', v0, {old_str: 'b\nc', new_str: 'b\nB\nC\nc'});
		const second = editCall('m2', v1, {old_str: 'd', new_str: 'D'});
		// one bullet per call, never merged: each carries its own diff counts
		const bullets = buildBullets([first, second]);
		expect(bullets).toHaveLength(2);
		expect(bullets.map(bullet => bullet.stats)).toEqual(['· +2 −0', '· +1 −1']);
		expect(bulletStats([first])).toBe('· +2 −0');
		expect(bulletStats([second])).toBe('· +1 −1');
	});

	test('show no stats for a call that has not settled', () => {
		const running = editCall(
			's1',
			'a\nb\n',
			{old_str: 'a', new_str: 'A'},
			{
				status: 'running',
				before: undefined,
			},
		);
		const failed = editCall(
			's2',
			'a\nb\n',
			{old_str: 'a', new_str: 'A'},
			{status: 'failed'},
		);
		const noSnapshot = editCall(
			's3',
			'a\nb\n',
			{old_str: 'a', new_str: 'A'},
			{before: undefined},
		);
		expect(bulletStats([running])).toBeUndefined();
		expect(bulletStats([failed])).toBeUndefined();
		expect(bulletStats([noSnapshot])).toBeUndefined();
	});

	test('stay stable when the layout is rebuilt for the same call', () => {
		const call = editCall('stable', 'a\nb\nc\nd\n', {
			old_str: 'b\nc',
			new_str: 'b\nB\nC\nc',
		});
		const first = bulletStats([call]);
		// a fresh object with the same id, as re-decoding a batch produces
		const second = bulletStats([{...call}]);
		expect(second).toBe(first);
		expect(first).toBe('· +2 −0');
	});

	test('a lone bullet is unindented; bullets under a root are indented', () => {
		const single = buildBullets([
			editCall('solo', 'a\nb\n', {old_str: 'a', new_str: 'A'}),
		]);
		expect(single[0]!.indent).toBe(0);

		// one call requesting several URLs still has no root: unindented
		const multiUrl = buildBullets([
			{
				id: 'web-1',
				name: 'get_web_page',
				arguments: {url: ['https://a.example', 'https://b.example']},
				status: 'done',
			},
		]);
		expect(multiUrl.map(bullet => bullet.indent)).toEqual([0, 0]);

		const grouped = buildBullets([
			editCall('g1', 'a\nb\n', {old_str: 'a', new_str: 'A'}),
			editCall('g2', 'c\nd\n', {old_str: 'c', new_str: 'C'}),
		]);
		expect(grouped.map(bullet => bullet.indent)).toEqual([2, 2]);
	});
});

describe('write bullet stats', () => {
	test('keep reporting the final line count', () => {
		const call: ToolCallEntry = {
			id: 'w1',
			name: 'write',
			arguments: {path: 'src/new.ts', content: 'l1\nl2\nl3\n'},
			status: 'done',
			before: null,
			stats: {lines: 3},
		};
		expect(bulletStats([call])).toBe('· 3 lines');
	});
});
