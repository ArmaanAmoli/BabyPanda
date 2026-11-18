import {describe, expect, test} from 'bun:test';
import {formatSessionTable} from './listSessions';
import type {SessionSummary} from './sessions';

function session(
	id: string,
	createdAt: number,
	messagesCount: number,
): SessionSummary {
	return {
		id,
		createdAt,
		parentSessionId: null,
		messagesCount,
		tokensInContextWindow: 0,
	};
}

const NOW = new Date(2026, 10, 17, 12, 0).getTime();
const HOUR = 3_600_000;

const SESSIONS = [
	session('01M77HWGB50QE8H3MTHFGPC4XY', NOW - 2 * HOUR, 2),
	session('01M76GD4617ZTSHNMWRWZ322Z0', NOW - 30 * HOUR, 277),
];

describe('formatSessionTable', () => {
	test('the header names every column', () => {
		const [header] = formatSessionTable(SESSIONS, NOW);
		expect(header).toBe(
			'  #  SESSION ID                  MESSAGES  CREATED           AGE',
		);
	});

	test('one row per session, numbered from one', () => {
		const rows = formatSessionTable(SESSIONS, NOW);
		expect(rows).toHaveLength(3);
		expect(rows[1]).toContain('01M77HWGB50QE8H3MTHFGPC4XY');
		expect(rows[1]?.startsWith('  1  ')).toBe(true);
		expect(rows[2]?.startsWith('  2  ')).toBe(true);
	});

	test('numeric columns are right aligned so magnitudes line up', () => {
		const rows = formatSessionTable(SESSIONS, NOW);
		// 2 and 277 share a column, so the shorter one is padded on the left
		expect(rows[1]).toContain('         2  2026-11-17 10:00  2h ago');
		expect(rows[2]).toContain('       277  2026-11-16 06:00  1d ago');
	});

	test('no row carries trailing whitespace', () => {
		for (const row of formatSessionTable(SESSIONS, NOW)) {
			expect(row).toBe(row.trimEnd());
		}
	});

	test('columns widen to fit the widest value', () => {
		const wide = [session('A'.repeat(40), NOW, 1)];
		const [header, row] = formatSessionTable(wide, NOW);
		// the id column is as wide as the widest id, so header and row stay
		// aligned on it even though the last column is trimmed
		expect(header!.indexOf('SESSION ID')).toBe(row!.indexOf('A'.repeat(40)));
		expect(row).toContain('A'.repeat(40));
	});
});
