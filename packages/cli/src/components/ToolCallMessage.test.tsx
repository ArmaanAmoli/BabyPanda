import {describe, expect, test} from 'bun:test';
import React from 'react';
import {EventEmitter} from 'node:events';
import {Box, Text, render as inkRender} from 'ink';
import {ToolCallMessage} from './ToolCallMessage';
import {ScrollProvider} from '../context/Scroll';
import {MouseContext} from '../context/MouseContext';
import {buildToolCallLayout} from '../utils/toolCallLayout';
import type {ToolCallBatch, ToolCallEntry} from '../types';

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

const noopMouse = {subscribe: () => {}, unsubscribe: () => {}};
const WIDTH = 76;

function writeCall(id: string, path: string, lines: string[]): ToolCallEntry {
	return {
		id,
		name: 'write',
		arguments: {path, content: lines.join('\n')},
		status: 'done',
		before: null,
	};
}

function editCall(id: string, path: string): ToolCallEntry {
	return {
		id,
		name: 'edit',
		arguments: {path, old_str: 'before', new_str: 'after'},
		status: 'done',
		before: 'before',
	};
}

function ToolCall({
	batch,
	chatHeight,
	diffExpanded = true,
}: {
	batch: ToolCallBatch;
	chatHeight: number;
	diffExpanded?: boolean;
}) {
	return (
		<ToolCallMessage
			batch={batch}
			expanded
			onToggleGroup={() => {}}
			isDiffExpanded={() => diffExpanded}
			onToggleDiff={() => {}}
			isCommandExpanded={() => false}
			onToggleCommand={() => {}}
			startRow={1}
			clipTop={0}
			visibleRows={chatHeight}
			chatHeight={chatHeight}
			width={WIDTH}
			focused={false}
		/>
	);
}

async function renderFrame(
	tree: React.ReactElement,
	{columns = 100, rows = 100} = {},
): Promise<string[]> {
	const stdout = new FakeStdout(columns, rows);
	const instance = inkRender(
		<MouseContext.Provider value={noopMouse}>
			<ScrollProvider>{tree}</ScrollProvider>
		</MouseContext.Provider>,
		{
			stdout: stdout as never,
			debug: true,
			exitOnCtrlC: false,
			patchConsole: false,
		},
	);
	await new Promise(resolve => setTimeout(resolve, 60));
	const frame = stdout.frames.at(-1) ?? '';
	instance.unmount();
	return frame.split('\n');
}

const FILE_LINES = Array.from(
	{length: 25},
	(_, index) => `const value${index} = ${index};`,
);

describe('ToolCallMessage diff rendering', () => {
	test('renders every row of a newly written file in order', async () => {
		const batch: ToolCallBatch = {
			id: 'batch-full',
			createdAt: 0,
			calls: [writeCall('call-full', 'src/app.tsx', FILE_LINES)],
		};
		const lines = await renderFrame(
			<Box flexDirection="column" width={WIDTH}>
				<ToolCall batch={batch} chatHeight={40} />
				<Text>AFTER</Text>
			</Box>,
		);

		expect(lines[0]).toBe('● writing  src/app.tsx');
		for (const [index, text] of FILE_LINES.entries()) {
			expect(lines[index + 1]).toContain(`+${text}`);
		}
		expect(lines[26]).toBe('AFTER');
		expect(lines.join('\n')).not.toContain('±');
		expect(lines.join('\n').match(/src\/app\.tsx/g)).toHaveLength(1);
	});

	test('an expanded edit also omits the duplicate path and stats header', async () => {
		const batch: ToolCallBatch = {
			id: 'batch-edit',
			createdAt: 0,
			calls: [editCall('call-edit', 'src/edited.ts')],
		};
		const lines = await renderFrame(
			<Box flexDirection="column" width={WIDTH}>
				<ToolCall batch={batch} chatHeight={40} />
				<Text>AFTER</Text>
			</Box>,
		);

		expect(lines[0]).toBe('● editing  src/edited.ts · +1 −1');
		expect(lines[1]).toContain('−before');
		expect(lines[2]).toContain('+after');
		expect(lines[3]).toBe('AFTER');
		expect(lines.join('\n')).not.toContain('±');
		expect(lines.join('\n').match(/src\/edited\.ts/g)).toHaveLength(1);
	});

	test('a collapsed diff renders only the grey tool-line path', async () => {
		const batch: ToolCallBatch = {
			id: 'batch-collapsed',
			createdAt: 0,
			calls: [writeCall('call-collapsed', 'src/app.tsx', ['one', 'two'])],
		};
		const lines = await renderFrame(
			<Box flexDirection="column" width={WIDTH}>
				<ToolCall batch={batch} chatHeight={40} diffExpanded={false} />
				<Text>AFTER</Text>
			</Box>,
		);

		expect(lines[0]).toBe('● writing  src/app.tsx');
		expect(lines[1]).toBe('AFTER');
		expect(lines.join('\n')).not.toContain('±');
		expect(lines.join('\n').match(/src\/app\.tsx/g)).toHaveLength(1);
	});

	test('keeps tab-indented CRLF source on one measurable terminal row per diff line', async () => {
		const sourceLines = [
			'\t\tconst short = true;',
			`\tconst long = "${'x'.repeat(180)}";`,
			'\t\tconst last = false;',
		];
		const call = writeCall('call-controls', 'src/controls.tsx', []);
		call.arguments['content'] = sourceLines.join('\r\n');
		const batch: ToolCallBatch = {
			id: 'batch-controls',
			createdAt: 0,
			calls: [call],
		};
		const lines = await renderFrame(
			<Box flexDirection="column" width={WIDTH}>
				<ToolCall batch={batch} chatHeight={40} />
				<Text>AFTER</Text>
			</Box>,
		);

		expect(lines[1 + sourceLines.length]).toBe('AFTER');
		for (const line of lines.slice(0, 1 + sourceLines.length)) {
			// Raw tabs and carriage returns are terminal commands, not printable
			// source text. Letting either reach the terminal corrupts Ink's grid.
			expect(
				[...line].some(character => {
					const code = character.charCodeAt(0);
					return code <= 0x1f || code === 0x7f;
				}),
			).toBe(false);
		}
		expect(lines[1]).toContain('1 +');
		expect(lines[2]).toContain('2 +');
		expect(lines[2]).toContain('…');
		expect(lines[3]).toContain('3 +');
	});

	test('a capped batch cannot paint its hidden rows over the next message', async () => {
		const batch: ToolCallBatch = {
			id: 'batch-capped',
			createdAt: 0,
			calls: [
				writeCall('call-a', 'src/a.tsx', FILE_LINES),
				writeCall('call-b', 'src/b.tsx', FILE_LINES),
				writeCall('call-c', 'src/c.tsx', FILE_LINES),
			],
		};
		const lines = await renderFrame(
			<Box flexDirection="column" width={WIDTH}>
				<ToolCall batch={batch} chatHeight={19} />
				<Text>AFTER</Text>
			</Box>,
			{rows: 30},
		);

		const height = buildToolCallLayout(batch, {
			expanded: true,
			isDiffExpanded: () => true,
			isCommandExpanded: () => false,
			chatHeight: 19,
			width: WIDTH,
		}).height;
		expect(lines[height]).toBe('AFTER');
		// The second viewer starts at line 13; only the six rows left in the
		// 19-line group window may be painted.
		expect(lines[13]).toContain('+const value0 = 0;');
		expect(lines[18]).toContain('+const value5 = 5;');
		expect(lines[19]).not.toContain('const value6');
	});

	test('an ancestor clip hides the rest of the diff instead of leaking it', async () => {
		const batch: ToolCallBatch = {
			id: 'batch-clipped',
			createdAt: 0,
			calls: [writeCall('call-clipped', 'src/app.tsx', FILE_LINES)],
		};
		const lines = await renderFrame(
			<Box flexDirection="column" width={WIDTH} height={9}>
				<Box height={7} overflow="hidden" flexDirection="column">
					<ToolCall batch={batch} chatHeight={40} />
				</Box>
				<Text>AFTER</Text>
			</Box>,
			{rows: 12},
		);

		expect(lines[7]).toBe('AFTER');
		expect(lines.slice(0, 7).join('\n')).toContain('+const value4 = 4;');
		expect(lines[7]).not.toContain('const value');
	});
});
