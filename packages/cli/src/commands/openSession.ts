import {currentProjectDirectory, matchSession} from './sessions';
import {getProjectSessions} from './sessionStore';

export type OpenResolution = {sessionId: string} | {error: string};

/**
 * `babypanda open <session-id>`: resolve the reference and hand the id back to
 * the terminal UI. The historical `babypanda <session-id>` form resolves the
 * same way, so both accept a unique prefix.
 */
export async function resolveSessionToOpen(
	reference: string,
): Promise<OpenResolution> {
	const sessions = await getProjectSessions();
	if (sessions.length === 0) {
		return {
			error: `no BabyPanda sessions in ${currentProjectDirectory()} — run \`babypanda\` to start one`,
		};
	}

	const resolution = matchSession(sessions, reference);
	if (resolution.ok) {
		return {sessionId: resolution.session.id};
	}
	if (resolution.reason === 'ambiguous') {
		const ids = resolution.matches?.map(session => session.id).join(', ') ?? '';
		return {error: `"${reference}" matches more than one session: ${ids}`};
	}
	return {
		error: `no session "${reference}" in ${currentProjectDirectory()} — run \`babypanda list\` to see them`,
	};
}
