import {describe, expect, test} from 'bun:test';
import {
	formatAge,
	formatCreatedAt,
	matchSession,
	type SessionSummary,
} from './sessions';

function session(
	id: string,
	overrides: Partial<SessionSummary> = {},
): SessionSummary {
	return {
		id,
		createdAt: 0,
		parentSessionId: null,
		messagesCount: 0,
		tokensInContextWindow: 0,
		...overrides,
	};
}

const SESSIONS = [
	session('01M77HWGB50QE8H3MTHFGPC4XY', {messagesCount: 2}),
	session('01M77HPPYHNZDYZTCHAXVMPF6B', {messagesCount: 0}),
	session('01M76GD4617ZTSHNMWRWZ322Z0', {messagesCount: 277}),
];

describe('matchSession', () => {
	test('a full id matches exactly', () => {
		const resolution = matchSession(SESSIONS, '01M76GD4617ZTSHNMWRWZ322Z0');
		expect(resolution.ok).toBe(true);
		expect(resolution.ok && resolution.session.messagesCount).toBe(277);
	});

	test('a unique prefix resolves to its session', () => {
		const resolution = matchSession(SESSIONS, '01M76GD');
		expect(resolution.ok).toBe(true);
		expect(resolution.ok && resolution.session.id).toBe(
			'01M76GD4617ZTSHNMWRWZ322Z0',
		);
	});

	test('prefix matching ignores case', () => {
		const resolution = matchSession(SESSIONS, '01m76gd');
		expect(resolution.ok).toBe(true);
		expect(resolution.ok && resolution.session.id).toBe(
			'01M76GD4617ZTSHNMWRWZ322Z0',
		);
	});

	test('an ambiguous prefix reports every candidate instead of guessing', () => {
		const resolution = matchSession(SESSIONS, '01M77');
		expect(resolution.ok).toBe(false);
		expect(!resolution.ok && resolution.reason).toBe('ambiguous');
		expect(!resolution.ok && resolution.matches?.map(item => item.id)).toEqual([
			'01M77HWGB50QE8H3MTHFGPC4XY',
			'01M77HPPYHNZDYZTCHAXVMPF6B',
		]);
	});

	test('an unknown reference is reported as not found', () => {
		const resolution = matchSession(SESSIONS, 'nope');
		expect(resolution.ok).toBe(false);
		expect(!resolution.ok && resolution.reason).toBe('not-found');
		expect(!resolution.ok && resolution.reference).toBe('nope');
	});

	test('an empty list never matches', () => {
		expect(matchSession([], '01M77').ok).toBe(false);
	});
});

describe('formatCreatedAt', () => {
	test('renders local date and time, zero padded', () => {
		const local = new Date(2026, 10, 17, 9, 5).getTime();
		expect(formatCreatedAt(local)).toBe('2026-11-17 09:05');
	});
});

describe('formatAge', () => {
	const now = new Date(2026, 10, 17, 12, 0).getTime();
	const at = (offsetMs: number) => now - offsetMs;

	test('under a minute is "just now"', () => {
		expect(formatAge(at(30_000), now)).toBe('just now');
	});

	test('minutes, hours and days each get their own unit', () => {
		expect(formatAge(at(5 * 60_000), now)).toBe('5m ago');
		expect(formatAge(at(3 * 3_600_000), now)).toBe('3h ago');
		expect(formatAge(at(2 * 86_400_000), now)).toBe('2d ago');
	});

	test('past a week it falls back to the absolute date', () => {
		const local = new Date(2026, 10, 1, 8, 30).getTime();
		expect(formatAge(local, now)).toBe('2026-11-01 08:30');
	});

	test('a future timestamp reads as "just now", never a negative age', () => {
		expect(formatAge(now + 60_000, now)).toBe('just now');
	});
});
