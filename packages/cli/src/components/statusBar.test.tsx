import {describe, expect, test} from 'bun:test';
import React from 'react';
import {EventEmitter} from 'node:events';
import {render as inkRender} from 'ink';
import {StatusBar, type StatusBarProps} from './statusBar';

class FakeStdout extends EventEmitter {
	columns: number;
	rows: number;
	frames: string[] = [];

	constructor(columns: number, rows: number) {
		super();
		this.columns = columns;
		this.rows = rows;
	}

	write(frame: string) {
		this.frames.push(frame);
	}
}

const SESSION_ID = '01M77HWGB50QE8H3MTHFGPC4XY';

/** Wide enough that the whole row fits without wrapping. */
const WIDE = 200;

function props(overrides: Partial<StatusBarProps> = {}): StatusBarProps {
	return {
		sessionId: SESSION_ID,
		sessionName: 'untitled-1',
		provider: 'Nvidia',
		model: 'moonshotai/kimi-k3.1-pro',
		reasoningEffort: 'high',
		contextWindow: 128_000,
		contextWindowUsed: 3_840,
		responding: false,
		spinnerFrame: 0,
		statusLabel: 'thinking',
		webSearchOff: false,
		...overrides,
	};
}

/** Renders the bar at a terminal width and returns its single row. */
async function renderRow(
	width: number,
	overrides: Partial<StatusBarProps> = {},
) {
	const stdout = new FakeStdout(width, 10);
	const instance = inkRender(<StatusBar {...props(overrides)} />, {
		stdout: stdout as never,
		debug: true,
		exitOnCtrlC: false,
		patchConsole: false,
	});
	await new Promise(resolve => setTimeout(resolve, 120));
	const frame = stdout.frames.at(-1) ?? '';
	instance.unmount();
	const rows = frame.split('\n');
	expect(rows).toHaveLength(1);
	return rows[0]!;
}

describe('status bar', () => {
	test('the session label is the last thing on the row', async () => {
		const row = await renderRow(WIDE);
		expect(row.endsWith('untitled-1')).toBe(true);
		expect(row).toContain(`Session ${SESSION_ID}`);
	});

	test('the model details fill the space before the label', async () => {
		const row = await renderRow(WIDE);
		expect(row).toContain('Nvidia · moonshotai/kimi-k3.1-pro · effort: high');
		expect(row).toContain('128,000 context · 3% used');
	});

	test('a narrow terminal drops the model tail before the label', async () => {
		const row = await renderRow(50, {sessionName: 'refactor auth'});
		expect(row.endsWith('refactor auth')).toBe(true);
		expect(row).not.toContain('% used');
	});

	test('no label leaves the row without one', async () => {
		const row = await renderRow(WIDE, {sessionName: ''});
		expect(row).toContain(`Session ${SESSION_ID}`);
		expect(row).not.toContain('untitled-1');
	});

	test('a zero context window reads as 0% rather than NaN', async () => {
		const row = await renderRow(WIDE, {contextWindow: 0, contextWindowUsed: 0});
		expect(row).toContain('0% used');
	});

	test('the web search notice comes after the model details', async () => {
		const row = await renderRow(WIDE, {webSearchOff: true});
		expect(row).toContain('web search off (/web-api-keys)');
		expect(row.indexOf('% used')).toBeLessThan(row.indexOf('web search off'));
	});

	test('responding puts the spinner and activity label first', async () => {
		const row = await renderRow(WIDE, {
			responding: true,
			statusLabel: 'compacting',
		});
		expect(row).toContain('compacting ·');
		expect(row.indexOf('compacting')).toBeLessThan(row.indexOf('Session'));
	});
});
