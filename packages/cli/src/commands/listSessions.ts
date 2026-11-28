import {
	currentProjectDirectory,
	formatAge,
	formatCreatedAt,
	type SessionSummary,
} from './sessions';
import {getProjectSessions} from './sessionStore';

export interface ListSessionsOptions {
	/** Emit the session list as JSON instead of a table. */
	json?: boolean;
}

interface Column {
	header: string;
	align: 'left' | 'right';
	value: (session: SessionSummary, index: number) => string;
}

function buildColumns(now: number): Column[] {
	return [
		{
			header: '#',
			align: 'right',
			value: (_session, index) => String(index + 1),
		},
		{header: 'SESSION ID', align: 'left', value: session => session.id},
		{header: 'NAME', align: 'left', value: session => session.name},
		{
			header: 'MESSAGES',
			align: 'right',
			value: session => String(session.messagesCount),
		},
		{
			header: 'CREATED',
			align: 'left',
			value: session => formatCreatedAt(session.createdAt),
		},
		{
			header: 'AGE',
			align: 'left',
			value: session => formatAge(session.createdAt, now),
		},
	];
}

/**
 * The session list as aligned text rows, header first.
 *
 * Kept separate from the command so the layout can be checked without a
 * database. `sessions` must not be empty.
 */
export function formatSessionTable(
	sessions: SessionSummary[],
	now: number,
): string[] {
	const columns = buildColumns(now);
	const widths = columns.map(column =>
		Math.max(
			column.header.length,
			...sessions.map((session, index) => column.value(session, index).length),
		),
	);
	const render = (cells: string[]) =>
		`  ${cells
			.map((cell, index) => {
				const width = widths[index]!;
				return columns[index]!.align === 'left'
					? cell.padEnd(width)
					: cell.padStart(width);
			})
			.join('  ')}`.trimEnd();

	return [
		render(columns.map(column => column.header)),
		...sessions.map((session, index) =>
			render(columns.map(column => column.value(session, index))),
		),
	];
}

/** `babypanda list`: every session recorded for the current directory. */
export async function listSessionsCommand(
	options: ListSessionsOptions = {},
): Promise<number> {
	const sessions = await getProjectSessions();

	if (options.json) {
		process.stdout.write(
			`${JSON.stringify(
				{projectDirectory: currentProjectDirectory(), sessions},
				null,
				2,
			)}\n`,
		);
		return 0;
	}

	if (sessions.length === 0) {
		process.stdout.write(
			`No BabyPanda sessions in ${currentProjectDirectory()}\n`,
		);
		process.stdout.write('Run `babypanda` to start one.\n');
		return 0;
	}

	const now = Date.now();
	process.stdout.write(
		`Sessions in ${currentProjectDirectory()} (${sessions.length})\n\n`,
	);
	for (const line of formatSessionTable(sessions, now)) {
		process.stdout.write(`${line}\n`);
	}
	process.stdout.write(
		'\nOpen one with `babypanda open <session-id>`, remove one with `babypanda delete <session-id>`.\n',
	);
	return 0;
}
