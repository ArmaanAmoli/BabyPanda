import {describe, expect, test} from 'bun:test';
import {
	enqueuePendingSkillMessage,
	takePendingSkillMessage,
} from './pendingSkillMessages';

describe('pendingSkillMessages', () => {
	test('parked messages are drained in order, once each', () => {
		enqueuePendingSkillMessage('review', 'first');
		enqueuePendingSkillMessage('review', 'second');
		expect(takePendingSkillMessage('review')).toBe('first');
		expect(takePendingSkillMessage('review')).toBe('second');
		expect(takePendingSkillMessage('review')).toBeUndefined();
	});

	test('messages are matched by skill name', () => {
		enqueuePendingSkillMessage('grill', 'held for grill');
		expect(takePendingSkillMessage('other-skill')).toBeUndefined();
		expect(takePendingSkillMessage('grill')).toBe('held for grill');
	});

	test('taking from an empty queue is undefined', () => {
		expect(takePendingSkillMessage('never-parked')).toBeUndefined();
	});

	test('parked content can be multimodal parts (images join the message)', () => {
		const content = [
			{type: 'text' as const, text: 'review this [image: image-1.png]'},
			{type: 'image' as const, image: 'data:image/png;base64,AAA='},
		];
		enqueuePendingSkillMessage('review', content);
		expect(takePendingSkillMessage('review')).toEqual(content);
	});
});
