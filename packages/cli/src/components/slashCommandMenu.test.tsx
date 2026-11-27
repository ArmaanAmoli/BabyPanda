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

/** Mirrors NAME_COLUMN_GAP in the layout module. */
const NAME_COLUMN_GAP = 2;
const NAME_COLUMN_WIDTH =
	Math.max(...entries.map(entry => entry.name.length)) + NAME_COLUMN_GAP;

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

describe('slash command menu', () => {
	test('renders one row per entry, name first and description second', async () => {
		const {instance, rows} = await renderMenu();
		const lines = rows();

		expect(lines).toHaveLength(entries.length);
		expect(lines[0]).toContain('brainstorming');
		expect(lines[0]).toContain('You MUST use this before any creative work');
		expect(lines[2]).toBe('model'.padEnd(NAME_COLUMN_WIDTH) + 'switch model');
		expect(lines[3]).toBe(
			'efforts'.padEnd(NAME_COLUMN_WIDTH) + 'set reasoning effort',
		);

		instance.unmount();
	});

	test('every description starts at the same column', async () => {
		const {instance, rows} = await renderMenu();
		const lines = rows();

		// The name column is shared, so the description of a short command
		// starts exactly where a long skill's does.
		lines.forEach((line, index) => {
			expect(line.slice(0, NAME_COLUMN_WIDTH)).toBe(
				entries[index]!.name.padEnd(NAME_COLUMN_WIDTH),
			);
		});

		instance.unmount();
	});

	test('a row never runs past the terminal width', async () => {
		const {instance, rows} = await renderMenu();
		for (const line of rows()) {
			expect(line.length).toBeLessThanOrEqual(WIDTH);
		}

		instance.unmount();
	});

	test('a description too long for the row is cut with an ellipsis', async () => {
		const {instance, rows} = await renderMenu();
		const lines = rows();

		expect(lines[0]!.endsWith('…')).toBe(true);
		expect(lines[1]!.endsWith('…')).toBe(true);
		// A short description is left whole.
		expect(lines[2]).not.toContain('…');

		instance.unmount();
	});

	test('arrow keys move the highlight and enter picks the highlighted row', async () => {
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
		await waitFor(() => selected.length === 1, 'third row selected');
		expect(selected).toEqual(['command:model']);

		instance.unmount();
	});

	test('the limit caps how many rows are drawn', async () => {
		const {instance, rows} = await renderMenu({limit: 2});

		expect(rows()).toHaveLength(2);

		instance.unmount();
	});

	test('a list longer than the limit still reaches every entry', async () => {
		const {instance, emit} = await renderMenu({limit: 2});

		// Past the window the highlight keeps moving, and the last entry is
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
