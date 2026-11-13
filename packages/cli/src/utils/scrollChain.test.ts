import {describe, expect, test} from 'bun:test';
import {chainScroll, scrollRoom} from './scrollChain';
import type {ScrollableEntry} from '../types';

/** A scrollable with a fixed scroll position, recording every scrollBy. */
function entry(
	id: string,
	state: {scrollTop: number; scrollHeight: number; innerHeight: number},
	options: {hasFocus?: () => boolean} = {},
): ScrollableEntry & {applied: number[]} {
	const applied: number[] = [];
	return {
		id,
		// never read by chainScroll; only getScrollState matters here
		ref: {current: null},
		getScrollState: () => state,
		scrollBy: delta => {
			applied.push(delta);
		},
		hasFocus: options.hasFocus,
		applied,
	};
}

const SCROLL_ROWS = 3;

describe('scrollRoom', () => {
	test('is the hidden rows below when scrolling down', () => {
		const target = entry('a', {scrollTop: 2, scrollHeight: 20, innerHeight: 8});
		expect(scrollRoom(target, SCROLL_ROWS)).toBe(10);
	});

	test('is zero at the bottom', () => {
		const target = entry('a', {
			scrollTop: 12,
			scrollHeight: 20,
			innerHeight: 8,
		});
		expect(scrollRoom(target, SCROLL_ROWS)).toBe(0);
	});

	test('is the hidden rows above when scrolling up', () => {
		const target = entry('a', {scrollTop: 5, scrollHeight: 20, innerHeight: 8});
		expect(scrollRoom(target, -SCROLL_ROWS)).toBe(-5);
	});

	test('is zero at the top', () => {
		const target = entry('a', {scrollTop: 0, scrollHeight: 20, innerHeight: 8});
		expect(scrollRoom(target, -SCROLL_ROWS)).toBe(0);
	});

	test('is zero for content that fits', () => {
		const target = entry('a', {scrollTop: 0, scrollHeight: 5, innerHeight: 8});
		expect(scrollRoom(target, SCROLL_ROWS)).toBe(0);
		expect(scrollRoom(target, -SCROLL_ROWS)).toBe(0);
	});
});

describe('chainScroll', () => {
	test('scrolls only the innermost region while it has room', () => {
		const diff = entry('diff', {
			scrollTop: 0,
			scrollHeight: 20,
			innerHeight: 8,
		});
		const group = entry('group', {
			scrollTop: 0,
			scrollHeight: 40,
			innerHeight: 20,
		});
		const chat = entry('chat', {
			scrollTop: 0,
			scrollHeight: 100,
			innerHeight: 30,
		});

		chainScroll([diff, group, chat], SCROLL_ROWS);

		expect(diff.applied).toEqual([SCROLL_ROWS]);
		expect(group.applied).toEqual([]);
		expect(chat.applied).toEqual([]);
	});

	test('chains to the chat box once the diff viewer is exhausted', () => {
		// the reported case: diff scrolled to its end, wheel keeps going
		const diff = entry('diff', {
			scrollTop: 12,
			scrollHeight: 20,
			innerHeight: 8,
		});
		const group = entry('group', {
			scrollTop: 20,
			scrollHeight: 40,
			innerHeight: 20,
		});
		const chat = entry('chat', {
			scrollTop: 0,
			scrollHeight: 100,
			innerHeight: 30,
		});

		chainScroll([diff, group, chat], SCROLL_ROWS);

		expect(diff.applied).toEqual([]);
		expect(group.applied).toEqual([]);
		expect(chat.applied).toEqual([SCROLL_ROWS]);
	});

	test('splits the delta between the diff viewer and the chat box', () => {
		// one row of room left in the viewer, three rows of wheel
		const diff = entry('diff', {
			scrollTop: 11,
			scrollHeight: 20,
			innerHeight: 8,
		});
		const chat = entry('chat', {
			scrollTop: 0,
			scrollHeight: 100,
			innerHeight: 30,
		});

		chainScroll([diff, chat], SCROLL_ROWS);

		expect(diff.applied).toEqual([1]);
		expect(chat.applied).toEqual([2]);
	});

	test('chains upwards to the chat box at the top of the diff', () => {
		const diff = entry('diff', {
			scrollTop: 0,
			scrollHeight: 20,
			innerHeight: 8,
		});
		const chat = entry('chat', {
			scrollTop: 30,
			scrollHeight: 100,
			innerHeight: 30,
		});

		chainScroll([diff, chat], -SCROLL_ROWS);

		expect(diff.applied).toEqual([]);
		expect(chat.applied).toEqual([-SCROLL_ROWS]);
	});

	test('passes through the group when it can still move', () => {
		const diff = entry('diff', {
			scrollTop: 12,
			scrollHeight: 20,
			innerHeight: 8,
		});
		const group = entry('group', {
			scrollTop: 0,
			scrollHeight: 40,
			innerHeight: 20,
		});
		const chat = entry('chat', {
			scrollTop: 0,
			scrollHeight: 100,
			innerHeight: 30,
		});

		chainScroll([diff, group, chat], SCROLL_ROWS);

		expect(diff.applied).toEqual([]);
		expect(group.applied).toEqual([SCROLL_ROWS]);
		expect(chat.applied).toEqual([]);
	});

	test('stops as soon as the delta is fully absorbed', () => {
		const diff = entry('diff', {
			scrollTop: 0,
			scrollHeight: 20,
			innerHeight: 8,
		});
		const chat = entry('chat', {
			scrollTop: 0,
			scrollHeight: 100,
			innerHeight: 30,
		});

		// exactly the room the viewer has left: nothing may chain onwards
		chainScroll([diff, chat], 12);

		expect(diff.applied).toEqual([12]);
		expect(chat.applied).toEqual([]);
	});

	test('skips regions without focus', () => {
		const diff = entry(
			'diff',
			{scrollTop: 0, scrollHeight: 20, innerHeight: 8},
			{hasFocus: () => false},
		);
		const chat = entry('chat', {
			scrollTop: 0,
			scrollHeight: 100,
			innerHeight: 30,
		});

		chainScroll([diff, chat], SCROLL_ROWS);

		expect(diff.applied).toEqual([]);
		expect(chat.applied).toEqual([SCROLL_ROWS]);
	});

	test('does nothing when no region can move', () => {
		const diff = entry('diff', {
			scrollTop: 12,
			scrollHeight: 20,
			innerHeight: 8,
		});
		const chat = entry('chat', {
			scrollTop: 70,
			scrollHeight: 100,
			innerHeight: 30,
		});

		chainScroll([diff, chat], SCROLL_ROWS);

		expect(diff.applied).toEqual([]);
		expect(chat.applied).toEqual([]);
	});

	test('does nothing for an empty region list', () => {
		expect(() => chainScroll([], SCROLL_ROWS)).not.toThrow();
	});
});
