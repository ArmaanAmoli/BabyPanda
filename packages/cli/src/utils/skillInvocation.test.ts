import {describe, expect, test} from 'bun:test';
import {splitSkillInvocation} from './skillInvocation';

describe('splitSkillInvocation', () => {
	test('declared arguments are split from the leftover message', () => {
		expect(
			splitSkillInvocation(['review', 'this', 'file', 'please'], 1),
		).toEqual({
			args: 'review',
			message: 'this file please',
		});
	});

	test('every token is consumed when the argument count matches', () => {
		expect(splitSkillInvocation(['a', 'b'], 2)).toEqual({
			args: 'a b',
			message: '',
		});
	});

	test('a skill without declared arguments leaves the whole text as the message', () => {
		expect(splitSkillInvocation(['do', 'the', 'thing'], 0)).toEqual({
			args: '',
			message: 'do the thing',
		});
	});

	test('missing arguments leave the message empty', () => {
		expect(splitSkillInvocation(['only-one'], 3)).toEqual({
			args: 'only-one',
			message: '',
		});
	});

	test('a negative argument count is treated as zero', () => {
		expect(splitSkillInvocation(['a'], -1)).toEqual({
			args: '',
			message: 'a',
		});
	});
});
