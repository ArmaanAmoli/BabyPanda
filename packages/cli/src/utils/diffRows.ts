import {diffLines} from 'diff';

export type UnifiedCellType = 'same' | 'added' | 'removed';

/** One vertical (GitHub-style) diff line. */
export interface UnifiedRow {
	kind: 'line';
	/** Line number in the file before the change; null for added lines. */
	oldNo: number | null;
	/** Line number in the file after the change; null for removed lines. */
	newNo: number | null;
	text: string;
	type: UnifiedCellType;
}

/** A collapsed run of unchanged lines between two visible hunks. */
export interface GapRow {
	kind: 'gap';
	/** How many unchanged file lines this row stands for. */
	hidden: number;
}

export type DiffRow = UnifiedRow | GapRow;

export interface UnifiedDiff {
	rows: DiffRow[];
	/** Index in `rows` of the first row that contains a change (for initial scroll). */
	firstChangeIndex: number;
	added: number;
	removed: number;
}

/** Unchanged lines kept around each change, like `git diff -U3`. */
export const DIFF_CONTEXT_LINES = 3;

interface Part {
	value: string;
	added?: boolean;
	removed?: boolean;
}

function splitLines(value: string): string[] {
	if (value.length === 0) return [];
	const lines = value.split('\n');
	// diffLines keeps a trailing newline on the last line; drop the phantom
	// empty line it would otherwise produce.
	if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
	return lines;
}

interface BuiltRow {
	row: DiffRow;
	changed: boolean;
}

/**
 * Keeps only the rows within DIFF_CONTEXT_LINES of a change and replaces
 * every skipped run of unchanged lines with a single gap row, so the viewer
 * shows just the changed regions (plus nearby context) instead of the whole
 * file.
 */
function collapseToHunks(built: BuiltRow[]): DiffRow[] {
	const keep = new Array<boolean>(built.length).fill(false);
	for (let i = 0; i < built.length; i++) {
		if (!built[i]!.changed) continue;
		const from = Math.max(0, i - DIFF_CONTEXT_LINES);
		const to = Math.min(built.length - 1, i + DIFF_CONTEXT_LINES);
		for (let j = from; j <= to; j++) keep[j] = true;
	}
	const rows: DiffRow[] = [];
	let index = 0;
	while (index < built.length) {
		if (keep[index]) {
			rows.push(built[index]!.row);
			index++;
			continue;
		}
		let end = index;
		while (end < built.length && !keep[end]) end++;
		rows.push({kind: 'gap', hidden: end - index});
		index = end;
	}
	return rows;
}

/**
 * Added/removed line counts for a before/after pair, without building the
 * diff rows. Counts match `buildUnifiedDiff` exactly, so a collapsed viewer
 * can show the same numbers the expanded one will.
 */
export function countDiffChanges(
	before: string,
	after: string,
): {added: number; removed: number} {
	let added = 0;
	let removed = 0;
	for (const part of diffLines(before, after) as Part[]) {
		if (part.added) {
			added += splitLines(part.value).length;
		} else if (part.removed) {
			removed += splitLines(part.value).length;
		}
	}
	return {added, removed};
}

/**
 * Builds vertical, GitHub-style rows from a before/after pair using jsdiff's
 * line diff: removed lines first (old number only), then added lines (new
 * number only), unchanged lines carrying both numbers. The result is then
 * collapsed to hunks: only changed rows and the DIFF_CONTEXT_LINES unchanged
 * rows around them stay visible, everything else becomes a single gap row.
 */
export function buildUnifiedDiff(before: string, after: string): UnifiedDiff {
	const parts = diffLines(before, after) as Part[];
	const built: BuiltRow[] = [];
	let oldNo = 1;
	let newNo = 1;
	let added = 0;
	let removed = 0;

	for (const part of parts) {
		if (part.removed) {
			const lines = splitLines(part.value);
			removed += lines.length;
			for (const line of lines) {
				built.push({
					row: {
						kind: 'line',
						oldNo: oldNo++,
						newNo: null,
						text: line,
						type: 'removed',
					},
					changed: true,
				});
			}
			continue;
		}
		if (part.added) {
			const lines = splitLines(part.value);
			added += lines.length;
			for (const line of lines) {
				built.push({
					row: {
						kind: 'line',
						oldNo: null,
						newNo: newNo++,
						text: line,
						type: 'added',
					},
					changed: true,
				});
			}
			continue;
		}
		const lines = splitLines(part.value);
		for (const line of lines) {
			built.push({
				row: {
					kind: 'line',
					oldNo: oldNo++,
					newNo: newNo++,
					text: line,
					type: 'same',
				},
				changed: false,
			});
		}
	}

	const rows = collapseToHunks(built);
	let firstChangeIndex = rows.findIndex(row =>
		row.kind === 'gap' ? false : row.type !== 'same',
	);
	if (firstChangeIndex === -1) firstChangeIndex = 0;

	return {
		rows,
		firstChangeIndex,
		added,
		removed,
	};
}

/**
 * Computes the "after" content of a write/edit call from its before-snapshot
 * and arguments, mirroring the edit tool's CRLF normalization.
 */
export function computeAfterContent(
	name: string,
	before: string | null,
	args: Record<string, unknown>,
): string {
	if (name === 'write') {
		return typeof args['content'] === 'string'
			? (args['content'] as string)
			: '';
	}
	// edit
	const oldStr =
		typeof args['old_str'] === 'string' ? (args['old_str'] as string) : '';
	const newStr =
		typeof args['new_str'] === 'string' ? (args['new_str'] as string) : '';
	if (before == null) return newStr;
	const usesCRLF = before.includes('\r\n');
	const data = usesCRLF ? before.replace(/\r\n/g, '\n') : before;
	const normalizedOld = oldStr.replace(/\r\n/g, '\n');
	const normalizedNew = newStr.replace(/\r\n/g, '\n');
	const replaced = data.replace(normalizedOld, normalizedNew);
	return usesCRLF ? replaced.replace(/\n/g, '\r\n') : replaced;
}
