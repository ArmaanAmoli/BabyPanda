import {createInterface} from 'node:readline';
import {deleteSession} from '@baby-panda/db';
import {
	currentProjectDirectory,
	matchSession,
	type SessionSummary,
} from './sessions';
import {getProjectSessions} from './sessionStore';

export interface DeleteSessionsOptions {
	/** Skip the confirmation prompt. Required when stdin is not a terminal. */
	yes?: boolean;
}

function plural(count: number, noun: string): string {
	return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function ask(question: string): Promise<string> {
	const rl = createInterface({input: process.stdin, output: process.stdout});
	return new Promise(resolve => {
		rl.question(question, answer => {
			rl.close();
			resolve(answer);
		});
	});
}

/**
 * Asks before anything is removed. A non-interactive stdin is refused rather
 * than assumed: a script that meant to delete one session must not be able to
 * wipe the directory's history by accident.
 */
async function confirmDeletion(sessions: SessionSummary[]): Promise<boolean> {
	if (!process.stdin.isTTY) {
		process.stderr.write(
			'Refusing to delete sessions without confirmation: stdin is not a terminal.\n',
		);
		process.stderr.write('Re-run with --yes to delete without prompting.\n');
		return false;
	}

	const messages = sessions.reduce(
		(total, session) => total + session.messagesCount,
		0,
	);
	process.stdout.write(
		`About to delete ${plural(sessions.length, 'session')} and ${plural(messages, 'message')}:\n`,
	);
	for (const session of sessions) {
		process.stdout.write(`  ${session.id}\n`);
	}

	const answer = await ask('Delete these sessions? [y/N] ');
	return /^y(es)?$/i.test(answer.trim());
}

export type SessionSelection =
	{ok: true; sessions: SessionSummary[]} | {ok: false; problems: string[]};

/**
 * Resolves every reference against the directory's sessions.
 *
 * All-or-nothing on purpose: one typo must not delete the sessions that were
 * named correctly, and the caller hears about every problem in one go rather
 * than one per retry. Naming the same session twice is one deletion.
 */
export function selectSessions(
	references: string[],
	sessions: SessionSummary[],
	projectDirectory: string,
): SessionSelection {
	const selected: SessionSummary[] = [];
	const problems: string[] = [];

	for (const reference of references) {
		const resolution = matchSession(sessions, reference);
		if (resolution.ok) {
			if (!selected.some(session => session.id === resolution.session.id)) {
				selected.push(resolution.session);
			}
			continue;
		}
		if (resolution.reason === 'ambiguous') {
			const ids =
				resolution.matches?.map(session => session.id).join(', ') ?? '';
			problems.push(`"${reference}" is ambiguous, it matches: ${ids}`);
		} else {
			problems.push(`"${reference}" is not a session in ${projectDirectory}`);
		}
	}

	if (problems.length > 0) {
		return {ok: false, problems};
	}
	return {ok: true, sessions: selected};
}

/**
 * `babypanda delete <session-id>...`
 *
 * Messages go with their session: the `message.session_id` foreign key
 * cascades, so a deleted session leaves nothing behind.
 */
export async function deleteSessionsCommand(
	references: string[],
	options: DeleteSessionsOptions = {},
): Promise<number> {
	if (references.length === 0) {
		process.stderr.write(
			'babypanda delete: expected at least one session id\n',
		);
		process.stderr.write('Run `babypanda list` to see the sessions here.\n');
		return 1;
	}

	const selection = selectSessions(
		references,
		await getProjectSessions(),
		currentProjectDirectory(),
	);
	if (!selection.ok) {
		for (const problem of selection.problems) {
			process.stderr.write(`${problem}\n`);
		}
		process.stderr.write('Nothing was deleted.\n');
		return 1;
	}

	if (!options.yes && !(await confirmDeletion(selection.sessions))) {
		process.stdout.write('Nothing was deleted.\n');
		return 1;
	}

	for (const session of selection.sessions) {
		await deleteSession(session.id);
	}

	process.stdout.write(
		`Deleted ${plural(selection.sessions.length, 'session')}:\n`,
	);
	for (const session of selection.sessions) {
		process.stdout.write(
			`  ${session.id} (${plural(session.messagesCount, 'message')})\n`,
		);
	}
	return 0;
}
