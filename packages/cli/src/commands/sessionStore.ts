import {getSessionsByProjectDirectory} from '@baby-panda/db';
import {
	currentProjectDirectory,
	matchSession,
	type SessionSummary,
} from './sessions';

/** Sessions recorded for the current working directory, newest first. */
export async function getProjectSessions(): Promise<SessionSummary[]> {
	const rows = await getSessionsByProjectDirectory(currentProjectDirectory());
	return rows
		.map(row => ({
			id: row.id,
			createdAt: row.createdAt,
			parentSessionId: row.parentSessionId,
			messagesCount: row.messagesCount,
			tokensInContextWindow: row.tokensInContextWindow,
		}))
		.sort((a, b) => b.createdAt - a.createdAt);
}

/** `matchSession` against the sessions of the current working directory. */
export async function resolveSession(reference: string) {
	return matchSession(await getProjectSessions(), reference);
}
