import type {ScrollableEntry} from '../types';

/**
 * How far `entry` can still move along `delta`, in rows. Zero when it already
 * sits at the boundary in that direction — which is exactly what lets a wheel
 * event chain outwards to the next scrollable region instead of being swallowed.
 */
export function scrollRoom(entry: ScrollableEntry, delta: number): number {
	const {scrollTop, scrollHeight, innerHeight} = entry.getScrollState();
	// scrolling up: whatever is hidden above the viewport
	if (delta < 0) return scrollTop > 0 ? -scrollTop : 0;
	// scrolling down: whatever is hidden below it
	return Math.max(0, scrollHeight - innerHeight - scrollTop);
}

/**
 * Applies one wheel delta to the innermost scrollable that can still move,
 * handing any remainder to the next one outwards.
 *
 * `entries` must be ordered innermost-first. Entries without focus are skipped,
 * and entries already at the boundary in this direction are passed over, so a
 * diff viewer scrolled to its end forwards the rest of the wheel to the chat
 * box (through the tool-call group when that one can still move too).
 */
export function chainScroll(entries: ScrollableEntry[], delta: number): void {
	let remaining = delta;
	for (const entry of entries) {
		if (remaining === 0) break;
		if (entry.hasFocus?.() === false) continue;
		const room = scrollRoom(entry, remaining);
		if (room === 0) continue;
		// the entry absorbs what it can; the rest keeps travelling outwards
		const applied = Math.abs(room) >= Math.abs(remaining) ? remaining : room;
		entry.scrollBy(applied);
		remaining -= applied;
	}
}
