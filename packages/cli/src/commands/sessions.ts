/**
 * The session domain as the system commands see it: the row shape, how a
 * user-supplied reference is matched against it, and how it is rendered.
 *
 * Deliberately free of any database import, so the matching and formatting
 * rules can be exercised without a `~/.babypanda` directory. `sessionStore.ts`
 * is where rows are actually read.
 */

/**
 * A session row as the system commands need it.
 *
 * The database is the single source of truth: the terminal UI keeps no session
 * list of its own, so whatever `babypanda list` prints is exactly what
 * `babypanda open` can resume and `babypanda delete` can remove.
 */
export interface SessionSummary {
	id: string;
	createdAt: number;
	parentSessionId: string | null;
	messagesCount: number;
	tokensInContextWindow: number;
	/** Human-facing label, unique inside the project directory. */
	name: string;
}

/** Directory a session belongs to. `createSession` stores `process.cwd()`. */
export function currentProjectDirectory(): string {
	return process.cwd();
}

export type SessionResolution =
	| {ok: true; session: SessionSummary}
	| {
			ok: false;
			reason: 'not-found' | 'ambiguous';
			reference: string;
			matches?: SessionSummary[];
	  };

/**
 * Matches a user-supplied session reference against an already-loaded list.
 *
 * A full id matches exactly. Anything shorter is treated as a prefix, because
 * ULIDs are long enough that typing one out by hand is unreasonable; an
 * ambiguous prefix is reported rather than guessed at.
 */
export function matchSession(
	sessions: SessionSummary[],
	reference: string,
): SessionResolution {
	const exact = sessions.find(session => session.id === reference);
	if (exact) {
		return {ok: true, session: exact};
	}

	const needle = reference.toLowerCase();
	const matches = sessions.filter(session =>
		session.id.toLowerCase().startsWith(needle),
	);
	if (matches.length === 1) {
		return {ok: true, session: matches[0]!};
	}
	if (matches.length > 1) {
		return {ok: false, reason: 'ambiguous', reference, matches};
	}
	return {ok: false, reason: 'not-found', reference};
}

const pad2 = (value: number) => String(value).padStart(2, '0');

/** Local `YYYY-MM-DD HH:mm`, the form a person scans a list by. */
export function formatCreatedAt(createdAt: number): string {
	const date = new Date(createdAt);
	return (
		`${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}` +
		` ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
	);
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Coarse "3 hours ago" style age, or an absolute date past a week. */
export function formatAge(createdAt: number, now: number): string {
	const elapsed = Math.max(0, now - createdAt);
	if (elapsed < MINUTE) return 'just now';
	if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`;
	if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`;
	if (elapsed < 7 * DAY) return `${Math.floor(elapsed / DAY)}d ago`;
	return formatCreatedAt(createdAt);
}
