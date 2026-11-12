import type {ToolCallEntry} from '../types';
import {
	buildSideBySide,
	computeAfterContent,
	countDiffChanges,
	type SideBySideDiff,
} from './diffRows';

/** Before/after content a write/edit call produces (mirrors the edit tool). */
function beforeAfterContent(call: ToolCallEntry): {
	before: string;
	after: string;
} {
	return {
		before: call.before ?? '',
		after: computeAfterContent(call.name, call.before ?? null, call.arguments),
	};
}

/** Full side-by-side diff for one write/edit call. */
export function buildCallDiff(call: ToolCallEntry): SideBySideDiff {
	const {before, after} = beforeAfterContent(call);
	return buildSideBySide(before, after);
}

/**
 * Header-only diff: the real added/removed counts without the rows, which a
 * collapsed viewer does not render.
 */
export function buildDiffSummary(call: ToolCallEntry): SideBySideDiff {
	const {added, removed} = diffCountsFor(call);
	return {rows: [], firstChangeIndex: 0, added, removed};
}

/**
 * Added/removed line counts for a write/edit call, cached by call id.
 *
 * `buildToolCallLayout` runs for every chat item on every stream chunk (the
 * batch is re-decoded each time, so call objects are never reused), which
 * makes an uncached line diff cost milliseconds per chunk. A call id is unique
 * within the one session a CLI process serves, and a call's before-snapshot
 * and arguments never change once its result has arrived, so the id is a safe
 * cache key. Only the two counts are retained, not the diff rows.
 */
const changeCounts = new Map<string, {added: number; removed: number}>();

export function diffCountsFor(call: ToolCallEntry): {
	added: number;
	removed: number;
} {
	const cached = changeCounts.get(call.id);
	if (cached) return cached;
	const {before, after} = beforeAfterContent(call);
	const counts = countDiffChanges(before, after);
	changeCounts.set(call.id, counts);
	return counts;
}
