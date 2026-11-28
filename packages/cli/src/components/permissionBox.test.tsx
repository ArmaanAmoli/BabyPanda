import {describe, expect, test} from 'bun:test';

/**
 * Component-level coverage for the permission prompt.
 *
 * The box is driven through Ink's internal input emitter, the way the slash
 * menu tests do it, and the socket is a recorder rather than a real WebSocket,
 * so a selection can be checked by the message it would have sent.
 */

import React from 'react';
import {EventEmitter} from 'node:events';
import {Readable} from 'node:stream';
import {Box, render as inkRender, useStdin} from 'ink';
import {
	PermissionBox,
	buildDenyMessage,
	getPermissionBoxHeight,
	getPermissionContentWidth,
	usePermissionModal,
} from './permissionBox';
import {TerminalProvider} from '../context/Terminal';
import {SessionProvider} from '../context/SessionDetails';
import {SocketContext} from '../context/WebSocket';
import {PendingPermissionMessagesContext} from '../context/PendingPermissionMessages';
import {getInputColumnWidth} from '../layout';
import {PermissionsEnums, WsEventTypes} from '@baby-panda/types';

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
const COMMAND =
	'npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"';

let emitter: EventEmitter | undefined;
let sent: unknown[] = [];
let pending: Array<{toolCallId: string; permission: boolean; content: string}> =
	[];
let dismissed = 0;

function Harness() {
	const context = useStdin() as unknown as {
		internal_eventEmitter: EventEmitter;
	};
	emitter = context.internal_eventEmitter;
	usePermissionModal();
	return (
		<Box>
			<PermissionBox />
		</Box>
	);
}

async function renderPermission({
	command = COMMAND,
	awaitingDecision = true,
}: {command?: string; awaitingDecision?: boolean} = {}) {
	emitter = undefined;
	sent = [];
	dismissed = 0;
	pending = awaitingDecision
		? [{toolCallId: 'call-1', permission: false, content: command}]
		: [];

	const stdout = new TestStdout(COLUMNS);
	const fakeStdin = new Readable({read() {}}) as FakeStdin;
	fakeStdin.isTTY = true;
	fakeStdin.setRawMode = () => fakeStdin;
	fakeStdin.ref = () => fakeStdin;
	fakeStdin.unref = () => fakeStdin;

	const socket = {
		send: (payload: string) => {
			sent.push(JSON.parse(payload));
		},
	} as unknown as WebSocket;

	const instance = inkRender(
		<TerminalProvider>
			<SessionProvider id="01TEST">
				<SocketContext.Provider value={socket}>
					<PendingPermissionMessagesContext.Provider
						value={{
							pendingPermissionMessages: pending,
							setPendingPermissionMessages: update => {
								dismissed += 1;
								pending =
									typeof update === 'function' ? update(pending) : update;
							},
						}}
					>
						<Harness />
					</PendingPermissionMessagesContext.Provider>
				</SocketContext.Provider>
			</SessionProvider>
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
	await sleep(250);

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
const ESC = '\u001b';

// eslint-disable-next-line no-control-regex
const ANSI_ESCAPE = /\u001b\[[0-9;]*m/g;

describe('permission box layout', () => {
	test('the command and the options are laid out inside the border', () => {
		// Two columns of border and two of padding on each side.
		expect(getPermissionContentWidth(WIDTH)).toBe(WIDTH - 6);
	});

	test('the height counts the command lines, the options and the box', () => {
		const short = getPermissionBoxHeight('echo hi', WIDTH);
		const long = getPermissionBoxHeight(`${COMMAND} && npm run build`, WIDTH);

		// A longer command wraps to more rows, so the box grows with it.
		expect(long).toBeGreaterThan(short);
		// Three options, one row each, plus the box around them.
		expect(short).toBe(1 + 3 + 6);
	});

	test('the height never drops below the options and the box', () => {
		// An empty command still owns its row, so the floor is one command
		// row, three option rows and the box around them.
		expect(getPermissionBoxHeight('', WIDTH)).toBe(1 + 3 + 6);
	});
});

describe('buildDenyMessage', () => {
	test('is an allow-once refusal carrying the tool call id', () => {
		expect(buildDenyMessage('call-9')).toEqual({
			eventType: WsEventTypes.permission,
			permission: PermissionsEnums.allowOnce,
			permissionGranted: false,
			toolCallId: 'call-9',
		});
	});
});

describe('permission box rendering', () => {
	test('draws the title into the top rule and the command inside', async () => {
		const {instance, rows} = await renderPermission();
		const lines = rows();

		expect(lines[0]!.startsWith('╭─ Shell command ')).toBe(true);
		expect(lines[0]!.endsWith('╮')).toBe(true);
		expect(lines.at(-1)!.startsWith('╰')).toBe(true);
		expect(lines.at(-1)!.endsWith('╯')).toBe(true);

		// Every side of the box is drawn, so the command cannot escape it.
		for (const line of lines) {
			expect(
				line.startsWith('│') || line.startsWith('╭') || line.startsWith('╰'),
			).toBe(true);
		}

		expect(lines.join('\n')).toContain('npx create-next-app@latest');

		instance.unmount();
	});

	test('the box spans the full input column', async () => {
		const {instance, rows} = await renderPermission();
		for (const line of rows()) {
			expect(line.length).toBe(WIDTH);
		}

		instance.unmount();
	});

	test('asks the question and lists all three options', async () => {
		const {instance, rows} = await renderPermission();
		const text = rows().join('\n');

		expect(text).toContain('Do you want to proceed?');
		expect(text).toContain('Allow');
		expect(text).toContain("Don't Allow");
		expect(text).toContain('Always Allow');

		instance.unmount();
	});

	test('a command too long for one row wraps inside the box', async () => {
		const {instance, rows} = await renderPermission({
			command: `${COMMAND} && npm install && npm run build && npm test`,
		});
		const lines = rows();

		const commandRows = lines.filter(
			line => line.includes('npx create-next-app') || line.includes('npm '),
		);
		expect(commandRows.length).toBeGreaterThan(1);
		for (const line of commandRows) {
			expect(line.startsWith('│')).toBe(true);
		}

		instance.unmount();
	});
});

describe('permission prompt is modal', () => {
	test('escape denies the newest prompt instead of doing nothing', async () => {
		const {instance, emit} = await renderPermission();

		emit(ESC);
		await waitFor(() => sent.length === 1, 'deny on escape');
		expect(sent[0]).toEqual({
			eventType: WsEventTypes.permission,
			permission: PermissionsEnums.allowOnce,
			permissionGranted: false,
			toolCallId: 'call-1',
		});
		expect(dismissed).toBe(1);

		instance.unmount();
	});

	test('every other key is swallowed while a prompt is up', async () => {
		const {instance, emit} = await renderPermission();

		// The hook is the app-level half of the modal behaviour: it takes the
		// keypresses so Tab, the chat shortcuts and the escape handler cannot
		// act on a tree the user is not looking at. Nothing here may send.
		emit('j');
		emit('k');
		emit(DOWN);
		emit(UP);
		emit('\t');
		await sleep(150);

		expect(sent).toEqual([]);
		expect(dismissed).toBe(0);

		instance.unmount();
	});

	test('the hook stands down once no prompt is pending', async () => {
		const {instance, emit} = await renderPermission({awaitingDecision: false});

		// With nothing pending the hook never subscribes, so it neither sends
		// nor dismisses — the app's own handlers own the keyboard again.
		emit(ESC);
		emit(ENTER);
		await sleep(150);

		expect(sent).toEqual([]);
		expect(dismissed).toBe(0);

		instance.unmount();
	});
});

describe('permission box selection', () => {
	test('enter on the highlighted option allows once', async () => {
		const {instance, emit} = await renderPermission();

		emit(ENTER);
		await waitFor(() => sent.length === 1, 'allow once');
		expect(sent[0]).toEqual({
			eventType: WsEventTypes.permission,
			permission: PermissionsEnums.allowOnce,
			permissionGranted: true,
			toolCallId: 'call-1',
		});

		instance.unmount();
	});

	test('stepping down to the second option denies', async () => {
		const {instance, emit} = await renderPermission();

		emit(DOWN);
		await sleep(50);
		emit(ENTER);
		await waitFor(() => sent.length === 1, 'deny');
		expect(sent[0]).toEqual({
			eventType: WsEventTypes.permission,
			permission: PermissionsEnums.allowOnce,
			permissionGranted: false,
			toolCallId: 'call-1',
		});

		instance.unmount();
	});

	test('the third option allows always', async () => {
		const {instance, emit} = await renderPermission();

		emit(DOWN);
		emit(DOWN);
		await sleep(50);
		emit(ENTER);
		await waitFor(() => sent.length === 1, 'allow always');
		expect(sent[0]).toEqual({
			eventType: WsEventTypes.permission,
			permission: PermissionsEnums.allowAlways,
		});

		instance.unmount();
	});

	test('the highlight wraps from the last option back to the first', async () => {
		const {instance, emit} = await renderPermission();

		emit(UP);
		await sleep(50);
		emit(ENTER);
		await waitFor(() => sent.length === 1, 'wrapped to allow always');
		expect(sent[0]).toEqual({
			eventType: WsEventTypes.permission,
			permission: PermissionsEnums.allowAlways,
		});

		instance.unmount();
	});
});
