import {describe, expect, test} from 'bun:test';
import {selectSessions} from './deleteSessions';
import type {SessionSummary} from './sessions';

function session(id: string, messagesCount = 0): SessionSummary {
	return {
		id,
		createdAt: 0,
		parentSessionId: null,
		messagesCount,
		tokensInContextWindow: 0,
	};
}

const SESSIONS = [
	session('01M77HWGB50QE8H3MTHFGPC4XY', 2),
	session('01M77HPPYHNZDYZTCHAXVMPF6B', 0),
	session('01M76GD4617ZTSHNMWRWZ322Z0', 277),
];
const DIRECTORY = '/repo';

describe('selectSessions', () => {
	test('resolves full ids and prefixes alike', () => {
		const selection = selectSessions(
			['01M77HWGB50QE8H3MTHFGPC4XY', '01M76GD'],
			SESSIONS,
			DIRECTORY,
		);
		expect(selection.ok).toBe(true);
		expect(selection.ok && selection.sessions.map(item => item.id)).toEqual([
			'01M77HWGB50QE8H3MTHFGPC4XY',
			'01M76GD4617ZTSHNMWRWZ322Z0',
		]);
	});

	test('naming the same session twice is one deletion', () => {
		const selection = selectSessions(
			['01M76GD4617ZTSHNMWRWZ322Z0', '01M76GD'],
			SESSIONS,
			DIRECTORY,
		);
		expect(selection.ok).toBe(true);
		expect(selection.ok && selection.sessions).toHaveLength(1);
	});

	test('one bad reference rejects the whole batch', () => {
		const selection = selectSessions(['01M76GD', 'typo'], SESSIONS, DIRECTORY);
		expect(selection.ok).toBe(false);
		expect(!selection.ok && selection.problems).toEqual([
			'"typo" is not a session in /repo',
		]);
	});

	test('every problem is reported at once, not one per retry', () => {
		const selection = selectSessions(
			['typo', '01M77', 'alsobad'],
			SESSIONS,
			DIRECTORY,
		);
		expect(selection.ok).toBe(false);
		expect(!selection.ok && selection.problems).toHaveLength(3);
		expect(!selection.ok && selection.problems[0]).toContain('"typo"');
		expect(!selection.ok && selection.problems[1]).toContain(
			'"01M77" is ambiguous',
		);
		expect(!selection.ok && selection.problems[2]).toContain('"alsobad"');
	});

	test('an ambiguous prefix lists its candidates', () => {
		const selection = selectSessions(['01M77'], SESSIONS, DIRECTORY);
		expect(selection.ok).toBe(false);
		expect(!selection.ok && selection.problems[0]).toBe(
			'"01M77" is ambiguous, it matches: 01M77HWGB50QE8H3MTHFGPC4XY, 01M77HPPYHNZDYZTCHAXVMPF6B',
		);
	});

	test('an empty directory rejects everything', () => {
		const selection = selectSessions(['01M77'], [], DIRECTORY);
		expect(selection.ok).toBe(false);
		expect(!selection.ok && selection.problems).toEqual([
			'"01M77" is not a session in /repo',
		]);
	});
});
