import {describe, expect, test} from 'bun:test';
import {ContentType, Role} from '@baby-panda/types';
import {buildTranscriptBoxes} from './responseSlots';

function roles(...list: (Role | ContentType)[]) {
	return list.map(role => ({role}));
}

describe('buildTranscriptBoxes', () => {
	test('a user message stands alone', () => {
		const boxes = buildTranscriptBoxes(
			roles(Role.user, ContentType.content, Role.user, ContentType.content),
		);
		expect(boxes).toEqual([
			{kind: 'user', index: 0},
			{kind: 'content', indices: [1]},
			{kind: 'user', index: 2},
			{kind: 'content', indices: [3]},
		]);
	});

	test('interleaved chunks land in fixed box order, not arrival order', () => {
		// a provider that emits content before reasoning inside one chunk
		const boxes = buildTranscriptBoxes(
			roles(
				Role.user,
				ContentType.content,
				ContentType.reasoning_content,
				ContentType.tool_call,
			),
		);
		expect(boxes).toEqual([
			{kind: 'user', index: 0},
			{kind: 'reasoning', indices: [2]},
			{kind: 'content', indices: [1]},
			{kind: 'tool', index: 3},
		]);
	});

	test('each iteration gets its own three boxes', () => {
		// two tool iterations, then a final tool-less one
		const boxes = buildTranscriptBoxes(
			roles(
				Role.user,
				ContentType.reasoning_content,
				ContentType.tool_call,
				ContentType.reasoning_content,
				ContentType.content,
				ContentType.tool_call,
				ContentType.reasoning_content,
				ContentType.content,
			),
		);
		expect(boxes).toEqual([
			{kind: 'user', index: 0},
			{kind: 'reasoning', indices: [1]},
			{kind: 'tool', index: 2},
			{kind: 'reasoning', indices: [3]},
			{kind: 'content', indices: [4]},
			{kind: 'tool', index: 5},
			{kind: 'reasoning', indices: [6]},
			{kind: 'content', indices: [7]},
		]);
	});

	test('reasoning chunks of one iteration merge into a single box', () => {
		const boxes = buildTranscriptBoxes(
			roles(
				Role.user,
				ContentType.reasoning_content,
				ContentType.content,
				ContentType.reasoning_content,
				ContentType.tool_call,
			),
		);
		expect(boxes).toEqual([
			{kind: 'user', index: 0},
			{kind: 'reasoning', indices: [1, 3]},
			{kind: 'content', indices: [2]},
			{kind: 'tool', index: 4},
		]);
	});

	test('a run with no tool calls keeps one iteration of reasoning and content', () => {
		const boxes = buildTranscriptBoxes(
			roles(Role.user, ContentType.reasoning_content, ContentType.content),
		);
		expect(boxes).toEqual([
			{kind: 'user', index: 0},
			{kind: 'reasoning', indices: [1]},
			{kind: 'content', indices: [2]},
		]);
	});

	test('skill notices render in place and split the iteration', () => {
		const boxes = buildTranscriptBoxes(
			roles(
				Role.user,
				Role.skill,
				ContentType.reasoning_content,
				ContentType.content,
			),
		);
		expect(boxes).toEqual([
			{kind: 'user', index: 0},
			{kind: 'prefix', index: 1},
			{kind: 'reasoning', indices: [2]},
			{kind: 'content', indices: [3]},
		]);
	});

	test('reloaded history groups identically to the live stream', () => {
		// live: content chunks carry ContentType.content; the DB stores the
		// same prose as Role.assistant — both belong to the content box
		const live = buildTranscriptBoxes(
			roles(Role.user, ContentType.reasoning_content, ContentType.content),
		);
		const reloaded = buildTranscriptBoxes(
			roles(Role.user, ContentType.reasoning_content, Role.assistant),
		);
		expect(reloaded).toEqual(live);
	});

	test('an empty transcript produces no boxes', () => {
		expect(buildTranscriptBoxes(roles())).toEqual([]);
	});
});
