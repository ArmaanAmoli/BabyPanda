import {describe, expect, test} from 'bun:test';
import {activityLabel} from './activityLabel';

describe('activityLabel', () => {
	test('compaction wins over a pending permission', () => {
		expect(activityLabel(true, true)).toBe('Compacting');
	});

	test('a pending permission reads as awaiting, not responding', () => {
		expect(activityLabel(false, true)).toBe('Awaiting permission');
	});

	test('ordinary streaming reads as responding', () => {
		expect(activityLabel(false, false)).toBe('Responding');
	});
});
