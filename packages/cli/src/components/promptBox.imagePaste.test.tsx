import {describe, expect, test, mock} from 'bun:test';

/**
 * Component-level coverage for clipboard image chips in the prompt box.
 *
 * The clipboard reader is mocked (no PowerShell in tests). Ink is driven
 * through its internal input emitter: ink-testing-library's stdin only emits
 * 'data', which Ink v7 (readable/read()) never consumes, so a real Readable
 * plus the StdinContext emitter is the reliable way to send keys. The
 * providers mirror cli.tsx — PromptBox throws without them.
 */

const images = [
	{width: 100, height: 80, dataUrl: 'data:image/png;base64,AAAA'},
	{width: 200, height: 160, dataUrl: 'data:image/png;base64,BBBB'},
	{width: 300, height: 240, dataUrl: 'data:image/png;base64,CCCC'},
];
let call = 0;

mock.module('../utils/readClipboardImage', () => ({
	// `readClipboardImages` yields every image the clipboard holds, so the
	// first Ctrl+O reads all three at once — Explorer's Copy puts a whole file
	// list on the clipboard — and every later press reads one, the common case.
	readClipboardImages: async () => (call++ === 0 ? images : [images[1]!]),
	MAX_IMAGES_PER_PASTE: 10,
}));

import React from 'react';
import {EventEmitter} from 'node:events';
import {Readable} from 'node:stream';
import type {ReadStream} from 'node:tty';
import {render as inkRender, useStdin} from 'ink';
import {
	getImageSegments,
	initializeImageIdFromHistory,
	promptText,
	textValue,
	type PromptValue,
} from '../utils/promptValue';

const {default: PromptBox} = await import('./promptBox');
const {TerminalProvider} = await import('../context/Terminal');
const {MouseProvider} = await import('../context/MouseContext');
const {ScrollProvider} = await import('../context/Scroll');
const {FilteredStdin} = await import('../utils/terminal/filterStdin');

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
	frames: string[] = [];
	columns = 100;
	rows = 24;
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

let emitter: EventEmitter | undefined;
let latestValue: PromptValue;

function Harness() {
	const [value, setValue] = React.useState<PromptValue>(() => textValue(''));
	const context = useStdin() as unknown as {
		internal_eventEmitter: EventEmitter;
	};
	emitter = context.internal_eventEmitter;
	latestValue = value;
	return (
		<PromptBox
			placeholder="write"
			value={value}
			onChange={setValue}
			onSubmit={() => {}}
			active
			maxHeight={8}
		/>
	);
}

async function renderPrompt() {
	emitter = undefined;
	// The image counter lives at module scope and every other test file that
	// pastes an image bumps it, so seed it from an empty history — exactly what
	// the app does on a fresh session — to keep the generated names stable.
	initializeImageIdFromHistory([]);
	const stdout = new TestStdout();
	const filteredStdin = new FilteredStdin(
		new Readable({read() {}}) as unknown as ReadStream,
	);
	const fakeStdin = new Readable({read() {}}) as FakeStdin;
	fakeStdin.isTTY = true;
	fakeStdin.setRawMode = () => fakeStdin;
	fakeStdin.ref = () => fakeStdin;
	fakeStdin.unref = () => fakeStdin;

	const instance = inkRender(
		<TerminalProvider>
			<MouseProvider filteredStdin={filteredStdin}>
				<ScrollProvider>
					<Harness />
				</ScrollProvider>
			</MouseProvider>
		</TerminalProvider>,
		{
			stdout: stdout as unknown as NodeJS.WriteStream,
			stdin: fakeStdin as unknown as NodeJS.ReadStream,
			debug: true,
			exitOnCtrlC: false,
			patchConsole: false,
		},
	);

	const latest = () => latestValue;
	const emit = (data: string) => {
		emitter!.emit('input', data);
	};

	await waitFor(() => emitter != null, 'Harness to mount');
	await sleep(300);

	return {instance, latest, emit};
}

describe('prompt box image chips', () => {
	test('one Ctrl+O with several clipboard images pastes them all', async () => {
		const {instance, latest, emit} = await renderPrompt();

		emit('\x0f');
		await waitFor(() => getImageSegments(latest()).length === 3, '3 images');

		const segments = getImageSegments(latest());
		// Numbering continues across the batch, and each keeps its own bytes.
		expect(segments.map(image => image.name)).toEqual([
			'image-1.png',
			'image-2.png',
			'image-3.png',
		]);
		expect(new Set(segments.map(image => image.dataUrl)).size).toBe(3);
		expect(promptText(latest())).toContain('[image: image-1.png]');
		expect(promptText(latest())).toContain('[image: image-3.png]');

		// One undo removes the whole batch, not one image at a time.
		emit('\x1a'); // Ctrl+Z
		await waitFor(() => getImageSegments(latest()).length === 0, 'undo');

		instance.unmount();
	});

	test('Backspace-erase, paste another, type -> exactly one image', async () => {
		const {instance, latest, emit} = await renderPrompt();

		emit('\x0f'); // Ctrl+O pastes image A
		await waitFor(() => getImageSegments(latest()).length === 1, 'image A');

		emit('\x7f'); // Backspace erases the whole chip
		await waitFor(() => getImageSegments(latest()).length === 0, 'erase');

		emit('\x0f'); // Ctrl+O pastes image B
		await waitFor(() => getImageSegments(latest()).length === 1, 'image B');

		emit('hello');
		await sleep(200);
		expect(getImageSegments(latest())).toHaveLength(1);

		instance.unmount();
	});

	test('Ctrl+W-erase, paste another, type -> exactly one image (no ghost chip)', async () => {
		const {instance, latest, emit} = await renderPrompt();

		emit('\x0f');
		await waitFor(() => getImageSegments(latest()).length === 1, 'image A');

		// A word delete over the placeholder used to leave a sliced image
		// segment behind, which then showed up as a second chip in the message.
		emit('\x17');
		await waitFor(
			() => getImageSegments(latest()).length === 0,
			'Ctrl+W erase',
		);

		emit('\x0f');
		await waitFor(() => getImageSegments(latest()).length === 1, 'image B');

		emit('hello');
		await sleep(200);
		expect(getImageSegments(latest())).toHaveLength(1);

		instance.unmount();
	});
});
