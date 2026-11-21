import {describe, expect, test} from 'bun:test';
import {buildUnifiedDiff} from './diffRows';

describe('buildUnifiedDiff', () => {
	test('normalizes CRLF without embedding carriage returns in display rows', () => {
		const diff = buildUnifiedDiff(
			'const before = true;\r\n',
			'\tconst after = true;\r\n\tconst next = true;\r\n',
		);

		expect(diff.added).toBe(2);
		expect(diff.removed).toBe(1);
		expect(diff.rows).toHaveLength(3);
		for (const row of diff.rows) {
			if (row.kind === 'line') expect(row.text).not.toContain('\r');
		}
	});
});
