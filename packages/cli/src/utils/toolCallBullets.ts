import type {ToolCallEntry, ToolCallStatus} from '../types';
import {diffCountsFor} from './toolCallDiff';

/**
 * View model for one bullet row in a ToolCallMessage. Raw tool names are
 * never shown: every bullet is status icon + verb + target + optional stats.
 */
export interface BulletView {
	/** Stable key (merged bullets keep the first call's id). */
	key: string;
	/** Underlying call ids, in order (more than one when merged per file). */
	callIds: string[];
	status: ToolCallStatus;
	verb: string;
	/** Display target: path | fileName | query | command | pattern | link. */
	target: string;
	/** Full URL when the target is a link (used for OSC 8 + the real request). */
	link?: string;
	/** Preformatted stats suffix, e.g. '· 10 lines', '· +12 −3', '· 8 results'. */
	stats?: string;
	/** True when at least one underlying call has a diff (write/edit). */
	hasDiff: boolean;
	/** Call ids rendered as diff viewers under this bullet. */
	diffCallIds: string[];
	/** True for shell bullets: clicking expands the full command below. */
	expandable: boolean;
	/** Combined error of failed underlying calls (shown when expanded). */
	error?: string;
}

/** Left padding of a bullet row (must match BulletRow in ToolCallMessage). */
export const BULLET_PADDING_LEFT = 1;

/**
 * Display columns available for a bullet's target text within `width`
 * (padding + icon + space + indent + verb + stats are reserved).
 */
export function bulletTargetMax(bullet: BulletView, width: number): number {
	const stats = bullet.stats ?? '';
	const verbLength = bullet.verb.length + 1; // verb + trailing space
	const reserved =
		BULLET_PADDING_LEFT +
		1 +
		1 +
		2 +
		verbLength +
		(stats.length > 0 ? stats.length + 1 : 0);
	return Math.max(1, width - reserved);
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

function combineStatus(statuses: ToolCallStatus[]): ToolCallStatus {
	if (statuses.some(status => status === 'running')) return 'running';
	if (statuses.some(status => status === 'failed')) return 'failed';
	return 'done';
}

function formatStats(name: string, calls: ToolCallEntry[]): string | undefined {
	if (name === 'write') {
		// merged writes to one file show the final line count
		const last = calls.at(-1)?.stats?.lines;
		return last !== undefined
			? `· ${last} line${last === 1 ? '' : 's'}`
			: undefined;
	}
	if (name === 'edit') {
		// Real added/removed from the before/after diff, so the bullet always
		// agrees with the diff viewer's header. `call.stats` counts the lines
		// of the raw old_str/new_str instead, which over-counts whenever the
		// model includes context lines to pin the match.
		let added = 0;
		let removed = 0;
		let known = false;
		for (const call of calls) {
			// `before` only arrives with the result, and a failed edit may not
			// have changed the file at all, so only settled calls are counted.
			if (call.status !== 'done' || call.before === undefined) continue;
			const counts = diffCountsFor(call);
			added += counts.added;
			removed += counts.removed;
			known = true;
		}
		return known ? `· +${added} −${removed}` : undefined;
	}
	const stats = calls.find(call => call.stats != null)?.stats;
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
 * Builds the bullet list for a batch. write/edit calls merge per file path
 * (summed stats, combined status, one diff per underlying call); get_web_page
 * expands to one bullet per requested URL; everything else is one bullet per
 * call.
 */
export function buildBullets(calls: ToolCallEntry[]): BulletView[] {
	const bullets: BulletView[] = [];
	const fileBulletByPath = new Map<string, BulletView>();

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
					hasDiff: false,
					diffCallIds: [],
					expandable: false,
					error: page?.error ?? (status === 'failed' ? call.error : undefined),
				});
			}
			continue;
		}

		if (isFileMutation(call.name)) {
			const path =
				typeof call.arguments['path'] === 'string'
					? (call.arguments['path'] as string)
					: '';
			const existing = path.length > 0 ? fileBulletByPath.get(path) : undefined;
			if (existing) {
				existing.callIds.push(call.id);
				existing.status = combineStatus([existing.status, call.status]);
				existing.stats = formatStats(
					call.name,
					existing.callIds.map(id => calls.find(c => c.id === id)!),
				);
				existing.diffCallIds.push(call.id);
				if (call.error) existing.error = call.error;
				continue;
			}
			const bullet: BulletView = {
				key: call.id,
				callIds: [call.id],
				status: call.status,
				verb: VERBS[call.name] ?? 'calling',
				target: path || bulletTarget(call.arguments),
				stats: formatStats(call.name, [call]),
				hasDiff: true,
				diffCallIds: [call.id],
				expandable: false,
				error: call.error,
			};
			fileBulletByPath.set(path, bullet);
			bullets.push(bullet);
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
			stats: formatStats(call.name, [call]),
			hasDiff: false,
			diffCallIds: [],
			expandable: call.name === 'shell',
			error: call.error,
		});
	}

	return bullets;
}

export function statusIcon(status: ToolCallStatus): string {
	if (status === 'done') return '✓';
	if (status === 'failed') return '✗';
	return '…';
}
