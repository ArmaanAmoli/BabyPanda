import {describe, expect, test} from 'bun:test';

/**
 * Component-level coverage for the slash-command menu.
 *
 * Ink is driven through its internal input emitter, the same way the prompt
 * box tests do it: ink-testing-library's stdin only emits 'data', which Ink v7
 * (readable/read()) never consumes. The providers mirror cli.tsx — the menu
 * reads the terminal size, so it throws without TerminalProvider.
 */

import React from 'react';
import {EventEmitter} from 'node:events';
import {Readable} from 'node:stream';
import {render as inkRender, useStdin} from 'ink';
import {SlashCommandMenu} from './commandMenu';
import {TerminalProvider} from '../context/Terminal';
import {getInputColumnWidth} from '../layout';
import type {SlashMenuEntry} from '../utils/slashMenuLayout';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function waitFor(condition: () => boolean, label: string) {
	const deadline = Date.now() + 5000;
	while (!condition()) {
		if (Date.now() > deadline)
			throw new Error(`Timed out waiting for ${label}`);
		await sleep(10);
	}
}

class TestStdout extends EventEmitter {
	columns: number;
	rows = 40;
	frames: string[] = [];

	constructor(columns: number) {
		super();
		this.columns = columns;
	}

	write = (frame: string) => {
		this.frames.push(frame);
	};
}

interface FakeStdin extends Readable {
	isTTY?: boolean;
	setRawMode: (mode: boolean) => FakeStdin;
	ref: () => FakeStdin;
	unref: () => FakeStdin;
}

const COLUMNS = 100;
const WIDTH = getInputColumnWidth(COLUMNS);

const entries: SlashMenuEntry[] = [
	{
		name: 'brainstorming',
		description:
			'You MUST use this before any creative work — creating features, building components, adding functionality.',
		value: 'skill:brainstorming',
	},
	{
		name: 'wireframe-suite',
		description:
			'Multi-mode wireframing toolkit for generating, critiquing, converting, and planning low-fidelity UI layouts.',
		value: 'skill:wireframe-suite',
	},
	{name: 'model', description: 'switch model', value: 'command:model'},
	{
		name: 'efforts',
		description: 'set reasoning effort',
		value: 'command:efforts',
	},
];

let emitter: EventEmitter | undefined;
let selected: string[] = [];

function Harness({items, limit}: {items: SlashMenuEntry[]; limit?: number}) {
	const context = useStdin() as unknown as {
		internal_eventEmitter: EventEmitter;
	};
	emitter = context.internal_eventEmitter;
	return (
		<SlashCommandMenu
			items={items}
			limit={limit}
			onSelect={value => {
				selected.push(value);
			}}
		/>
	);
}

async function renderMenu({
	items = entries,
	limit,
}: {items?: SlashMenuEntry[]; limit?: number} = {}) {
	emitter = undefined;
	selected = [];
	const stdout = new TestStdout(COLUMNS);
	const fakeStdin = new Readable({read() {}}) as FakeStdin;
	fakeStdin.isTTY = true;
	fakeStdin.setRawMode = () => fakeStdin;
	fakeStdin.ref = () => fakeStdin;
	fakeStdin.unref = () => fakeStdin;

	const instance = inkRender(
		<TerminalProvider>
			<Harness items={items} limit={limit} />
		</TerminalProvider>,
		{
			stdout: stdout as unknown as NodeJS.WriteStream,
			stdin: fakeStdin as unknown as NodeJS.ReadStream,
			debug: true,
			exitOnCtrlC: false,
			patchConsole: false,
		},
	);

	await waitFor(() => emitter != null, 'Harness to mount');
	await sleep(200);

	const rows = () =>
		(stdout.frames.at(-1) ?? '')
			.replace(ANSI_ESCAPE, '')
			.split('\n')
			.filter(line => line.length > 0);
	const emit = (data: string) => {
		emitter!.emit('input', data);
	};

	return {instance, rows, emit};
}

const DOWN = '\u001b[B';
const UP = '\u001b[A';
const ENTER = '\r';

// Colour escapes are dropped so the assertions read the row text alone. Chalk
// emits none when stdout is not a TTY, but the strip keeps that from mattering.
// eslint-disable-next-line no-control-regex
const ANSI_ESCAPE = /\u001b\[[0-9;]*m/g;

/** Mirrors NAME_COLUMN_GAP in the layout module. */
const NAME_COLUMN_GAP = 2;
const NAME_COLUMN_WIDTH =
	Math.max(...entries.map(entry => entry.name.length)) + NAME_COLUMN_GAP;

describe('slash command menu', () => {
	test('renders one entry per command, name first and description second', async () => {
		const {instance, rows} = await renderMenu();
		const lines = rows();

		expect(lines[0]).toContain('brainstorming');
		expect(lines[0]).toContain('You MUST use this before any creative work');
		expect(lines.at(-1)).toBe(
			'efforts'.padEnd(NAME_COLUMN_WIDTH) + 'set reasoning effort',
		);

		instance.unmount();
	});

	test('every description starts at the same column', async () => {
		const {instance, rows} = await renderMenu();
		const lines = rows();

		// The name column is shared, so the description of a short command
		// starts exactly where a long skill's does.
		for (const entry of entries) {
			const firstRow = lines.find(line =>
				line.startsWith(entry.name.padEnd(NAME_COLUMN_WIDTH)),
			);
			expect(firstRow).toBeDefined();
			expect(firstRow!.slice(0, NAME_COLUMN_WIDTH).trimEnd()).toBe(entry.name);
			expect(firstRow![NAME_COLUMN_WIDTH]).not.toBe(' ');
		}

		instance.unmount();
	});

	test('a row never runs past the terminal width', async () => {
		const {instance, rows} = await renderMenu();
		for (const line of rows()) {
			expect(line.length).toBeLessThanOrEqual(WIDTH);
		}

		instance.unmount();
	});

	test('a long description wraps onto indented rows instead of being cut', async () => {
		const {instance, rows} = await renderMenu();
		const lines = rows();

		// The first entry's description is far longer than one row, so it owns
		// several; none of them ends in an ellipsis.
		const firstEntryRows = lines.slice(
			0,
			lines.findIndex(line => line.startsWith('wireframe-suite')),
		);
		expect(firstEntryRows.length).toBeGreaterThan(1);
		for (const line of firstEntryRows) {
			expect(line).not.toContain('…');
		}

		// Every row after the first is indented to the description column, so
		// the wrapped block reads as one entry.
		for (const line of firstEntryRows.slice(1)) {
			expect(line.slice(0, NAME_COLUMN_WIDTH)).toBe(
				' '.repeat(NAME_COLUMN_WIDTH),
			);
			expect(line.slice(NAME_COLUMN_WIDTH)).not.toBe('');
		}

		instance.unmount();
	});

	test('nothing is dropped from a wrapped description', async () => {
		const {instance, rows} = await renderMenu();
		const lines = rows();

		const firstEntryRows = lines.slice(
			0,
			lines.findIndex(line => line.startsWith('wireframe-suite')),
		);
		const rejoined = firstEntryRows
			.map(line => line.slice(NAME_COLUMN_WIDTH))
			.join(' ')
			.replace(/\s+/g, ' ');

		expect(rejoined).toContain(
			'You MUST use this before any creative work — creating features, building components, adding functionality.',
		);

		instance.unmount();
	});

	test('arrow keys move the highlight and enter picks the highlighted entry', async () => {
		const {instance, emit} = await renderMenu();

		emit(DOWN);
		await sleep(50);
		emit(ENTER);
		await waitFor(() => selected.length === 1, 'first selection');
		expect(selected).toEqual(['skill:wireframe-suite']);

		emit(UP);
		emit(UP);
		await sleep(50);
		emit(ENTER);
		await waitFor(() => selected.length === 2, 'second selection');
		// Wrapping backwards from the top lands on the last entry.
		expect(selected[1]).toBe('command:efforts');

		instance.unmount();
	});

	test('stepping down the list walks it in order', async () => {
		const {instance, emit} = await renderMenu();

		emit(DOWN);
		emit(DOWN);
		await sleep(50);
		emit(ENTER);
		await waitFor(() => selected.length === 1, 'third entry selected');
		expect(selected).toEqual(['command:model']);

		instance.unmount();
	});

	test('the row budget caps how many rows are drawn', async () => {
		const {instance, rows} = await renderMenu({limit: 3});
		const lines = rows();

		// The budget is in rows, not entries, so a wrapped entry that does not
		// fit is left out whole rather than being split across the fold.
		expect(lines.length).toBeGreaterThan(0);
		expect(lines.length).toBeLessThanOrEqual(3);

		instance.unmount();
	});

	test('a list taller than the budget still reaches every entry', async () => {
		const {instance, emit} = await renderMenu({limit: 3});

		// Past the budget the highlight keeps moving, and the last entry is
		// still selectable rather than being stranded below the fold.
		emit(DOWN);
		emit(DOWN);
		emit(DOWN);
		await sleep(50);
		emit(ENTER);
		await waitFor(() => selected.length === 1, 'last entry selected');
		expect(selected).toEqual(['command:efforts']);

		instance.unmount();
	});
});
