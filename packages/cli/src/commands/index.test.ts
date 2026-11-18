import {describe, expect, test} from 'bun:test';
import {parseArguments} from './index';

const SPEC = {
	switches: {json: ['--json'], yes: ['--yes', '-y'], force: ['--force', '-f']},
	options: {directory: ['--dir', '-d']},
};

function parse(args: string[]) {
	const result = parseArguments(args, SPEC);
	if (!result.ok) {
		throw new Error(`expected success, got: ${result.error}`);
	}
	return result;
}

describe('parseArguments', () => {
	test('positionals are collected in order', () => {
		const parsed = parse(['01ABC', '01DEF']);
		expect(parsed.positionals).toEqual(['01ABC', '01DEF']);
	});

	test('a lone dash is a positional, not a flag', () => {
		expect(parse(['-']).positionals).toEqual(['-']);
	});

	test('switches are recorded under their canonical name', () => {
		const parsed = parse(['--json']);
		expect(parsed.switches).toEqual({json: true});
		expect(parsed.positionals).toEqual([]);
	});

	test('aliases collapse onto one canonical name', () => {
		expect(parse(['-y']).switches).toEqual({yes: true});
		expect(parse(['--yes']).switches).toEqual({yes: true});
		expect(parse(['-f']).switches).toEqual({force: true});
	});

	test('an option takes the next argument', () => {
		const parsed = parse(['--dir', '/tmp/bpbin']);
		expect(parsed.options).toEqual({directory: '/tmp/bpbin'});
		expect(parsed.positionals).toEqual([]);
	});

	test('an option accepts =value', () => {
		expect(parse(['--dir=/tmp/bpbin']).options).toEqual({
			directory: '/tmp/bpbin',
		});
	});

	test('an option value that looks like a flag is still consumed', () => {
		// a directory could legitimately be named "-d"
		expect(parse(['--dir', '-d']).options).toEqual({directory: '-d'});
	});

	test('flags and positionals interleave freely', () => {
		const parsed = parse(['01ABC', '--json', '01DEF', '--dir', '/tmp', '-y']);
		expect(parsed.positionals).toEqual(['01ABC', '01DEF']);
		expect(parsed.switches).toEqual({json: true, yes: true});
		expect(parsed.options).toEqual({directory: '/tmp'});
	});

	test('everything after -- is a positional', () => {
		const parsed = parse(['--', '--json', '-d']);
		expect(parsed.positionals).toEqual(['--json', '-d']);
		expect(parsed.switches).toEqual({});
	});

	test('an unknown flag is an error', () => {
		const result = parseArguments(['--nope'], SPEC);
		expect(result.ok).toBe(false);
		expect(!result.ok && result.error).toBe('unknown option --nope');
	});

	test('a switch given a value is an error', () => {
		const result = parseArguments(['--json=1'], SPEC);
		expect(result.ok).toBe(false);
		expect(!result.ok && result.error).toBe('--json does not take a value');
	});

	test('an option with no value is an error', () => {
		const result = parseArguments(['--dir'], SPEC);
		expect(result.ok).toBe(false);
		expect(!result.ok && result.error).toBe('--dir needs a value');
	});

	test('no arguments is a valid empty parse', () => {
		const parsed = parse([]);
		expect(parsed.positionals).toEqual([]);
		expect(parsed.switches).toEqual({});
		expect(parsed.options).toEqual({});
	});
});
