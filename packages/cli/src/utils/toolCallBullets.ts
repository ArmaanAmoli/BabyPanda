import type {ToolCallEntry, ToolCallStatus} from '../types';
import {diffCountsFor} from './toolCallDiff';
import {STATUS_DONE, STATUS_FAILED, STATUS_RUNNING} from '../theme';

/**
 * View model for one bullet row in a ToolCallMessage. Raw tool names are
 * never shown: every bullet is a status-coloured dot + verb + target +
 * optional stats. Status is carried entirely by the dot's colour, so the text
 * stays neutral and red/green never appear anywhere but the dot and a diff.
 */
export interface BulletView {
	/** Stable key (the call id, or `<callId>#<url>` for get_web_page). */
	key: string;
	/** Underlying call ids, in order. */
	callIds: string[];
	status: ToolCallStatus;
	verb: string;
	/** Display target: path | fileName | query | command | pattern | link. */
	target: string;
	/** Full URL when the target is a link (used for OSC 8 + the real request). */
	link?: string;
	/** Preformatted stats suffix, e.g. '· 10 lines', '· +12 −3', '· 8 results'. */
	stats?: string;
	/** True when the call has a diff (write/edit). */
	hasDiff: boolean;
	/** Call ids rendered as diff viewers under this bullet. */
	diffCallIds: string[];
	/** True for shell bullets: clicking expands the full command below. */
	expandable: boolean;
	/** Error text for a failed call (shown when expanded). */
	error?: string;
	/**
	 * Left indent of this bullet's rows. Indent marks a child of a root: a
	 * batch with a `■ N tools` root indents its bullets; a single-call batch
	 * (no root, including one multi-URL call expanding to several bullets)
	 * renders them unindented at column 0.
	 */
	indent: number;
}

/** Status colour of a bullet dot. Yellow also covers "awaiting permission". */
export function statusColor(status: ToolCallStatus): string {
	if (status === 'done') return STATUS_DONE;
	if (status === 'failed') return STATUS_FAILED;
	return STATUS_RUNNING;
}

// ---------- row geometry (must match BulletRow in ToolCallMessage) ----------

/** Indent of a child bullet under its batch root. */
export const BULLET_INDENT = 2;
/** Width of the `●` glyph. */
export const BULLET_GLYPH_WIDTH = 1;
/** Space between the glyph and the verb. */
export const BULLET_GLYPH_GAP = 1;
/** Spaces between the verb and the target. */
export const BULLET_VERB_GAP = 2;
/** Separator before the stats suffix (` · `). */
export const BULLET_STATS_GAP = 3;

/**
 * Display columns available for a bullet's target text within `rowWidth`
 * (the full row width, indent included).
 */
export function bulletTargetMax(bullet: BulletView, rowWidth: number): number {
	const stats = bullet.stats ?? '';
	const reserved =
		bullet.indent +
		BULLET_GLYPH_WIDTH +
		BULLET_GLYPH_GAP +
		bullet.verb.length +
		BULLET_VERB_GAP +
		(stats.length > 0 ? BULLET_STATS_GAP + stats.length : 0);
	return Math.max(1, rowWidth - reserved);
}

const VERBS: Record<string, string> = {
	write: 'writing',
	edit: 'editing',
	read: 'reading',
	delete: 'deleting',
	list: 'listing',
	mkdir: 'creating',
	glob: 'finding',
	grep: 'searching',
	shell: 'running',
	web_search: 'searching the web',
	get_web_page: 'opening',
	write_notes: 'saving note',
	edit_notes: 'editing note',
	read_notes: 'reading note',
	list_notes: 'listing notes',
	add_content_to_memory: 'updating memory',
};

function firstStringArg(args: Record<string, unknown>): string | undefined {
	for (const value of Object.values(args)) {
		if (typeof value === 'string' && value.length > 0) return value;
	}
	return undefined;
}

/** The most relevant argument to display as the bullet target. */
export function bulletTarget(args: Record<string, unknown>): string {
	for (const key of [
		'path',
		'fileName',
		'query',
		'command',
		'pattern',
	] as const) {
		const value = args[key];
		if (typeof value === 'string' && value.length > 0) return value;
	}
	const url = args['url'];
	if (typeof url === 'string' && url.length > 0) return url;
	if (Array.isArray(url) && typeof url[0] === 'string') return url[0];
	return firstStringArg(args) ?? '';
}

/**
 * Stats suffix for one call. `edit` uses the real added/removed from the
 * before/after diff rather than `call.stats`, which counts the lines of the
 * raw old_str/new_str and over-reports whenever the model includes context
 * lines to pin the match.
 */
function formatStats(name: string, call: ToolCallEntry): string | undefined {
	if (name === 'write') {
		const lines = call.stats?.lines;
		return lines !== undefined
			? `· ${lines} line${lines === 1 ? '' : 's'}`
			: undefined;
	}
	if (name === 'edit') {
		// `before` only arrives with the result, and a failed edit may not have
		// changed the file at all, so only settled calls are counted.
		if (call.status !== 'done' || call.before === undefined) return undefined;
		const counts = diffCountsFor(call);
		return `· +${counts.added} −${counts.removed}`;
	}
	const stats = call.stats;
	if (stats == null) return undefined;
	if (stats.matches !== undefined)
		return `· ${stats.matches} result${stats.matches === 1 ? '' : 's'}`;
	if (stats.results !== undefined)
		return `· ${stats.results} result${stats.results === 1 ? '' : 's'}`;
	if (stats.lines !== undefined)
		return `· ${stats.lines} line${stats.lines === 1 ? '' : 's'}`;
	return undefined;
}

function isFileMutation(name: string): boolean {
	return name === 'write' || name === 'edit';
}

/**
 * Builds the bullet list for a batch: exactly one bullet per tool call.
 *
 * `get_web_page` is the one exception — a single call can request several
 * URLs, and one dot cannot show several outcomes, so it expands to one bullet
 * per requested URL.
 */
export function buildBullets(calls: ToolCallEntry[]): BulletView[] {
	const bullets: BulletView[] = [];
	// matches the layout's hasRoot rule: a batch of one call has no root, so
	// its bullets sit at column 0 instead of indenting under nothing
	const indent = calls.length > 1 ? BULLET_INDENT : 0;

	for (const call of calls) {
		if (call.name === 'get_web_page') {
			const urls = Array.isArray(call.arguments['url'])
				? (call.arguments['url'] as unknown[]).filter(
						(item): item is string => typeof item === 'string',
					)
				: [];
			for (const url of urls) {
				const page = call.pages?.find(entry => entry.url === url);
				const status: ToolCallStatus = page
					? page.success
						? 'done'
						: 'failed'
					: call.status === 'running'
						? 'running'
						: call.status;
				bullets.push({
					key: `${call.id}#${url}`,
					callIds: [call.id],
					status,
					verb: VERBS['get_web_page'] ?? 'opening',
					target: url,
					link: url,
					stats: formatStats(call.name, call),
					hasDiff: false,
					diffCallIds: [],
					expandable: false,
					error: page?.error ?? (status === 'failed' ? call.error : undefined),
					indent,
				});
			}
			continue;
		}

		bullets.push({
			key: call.id,
			callIds: [call.id],
			status: call.status,
			verb: VERBS[call.name] ?? 'calling',
			target:
				call.name === 'web_search'
					? `"${bulletTarget(call.arguments)}"`
					: bulletTarget(call.arguments),
			stats: formatStats(call.name, call),
			hasDiff: isFileMutation(call.name),
			diffCallIds: isFileMutation(call.name) ? [call.id] : [],
			expandable: call.name === 'shell',
			error: call.error,
			indent,
		});
	}

	return bullets;
}

/** Aggregate status of a batch: any running wins, then any failed. */
export function combineStatus(statuses: ToolCallStatus[]): ToolCallStatus {
	if (statuses.some(status => status === 'running')) return 'running';
	if (statuses.some(status => status === 'failed')) return 'failed';
	return 'done';
}
