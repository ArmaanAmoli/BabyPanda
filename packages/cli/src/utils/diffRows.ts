import {diffLines} from 'diff';

export type SideCellType = 'same' | 'removed' | 'added' | 'empty';

export interface SideCell {
	lineNo: number | null;
	text: string;
	type: SideCellType;
}

export interface SideBySideRow {
	kind: 'line';
	left: SideCell;
	right: SideCell;
}

/** A collapsed run of unchanged lines between two visible hunks. */
export interface GapRow {
	kind: 'gap';
	/** How many unchanged file lines this row stands for. */
	hidden: number;
}

export type DiffRow = SideBySideRow | GapRow;

export interface SideBySideDiff {
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
	row: SideBySideRow;
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
 * Builds side-by-side rows from a before/after pair using jsdiff's line diff.
 * Unchanged parts appear on both sides (dim); a removed part followed by an
 * added part is paired row-by-row, with the longer side's extra lines getting
 * an empty opposite cell; removed-only rows get an empty right cell and
 * added-only rows an empty left cell. The result is then collapsed to hunks:
 * only changed rows and the DIFF_CONTEXT_LINES unchanged rows around them
 * stay visible, everything else becomes a single gap row.
 */
export function buildSideBySide(before: string, after: string): SideBySideDiff {
	const parts = diffLines(before, after) as Part[];
	const built: BuiltRow[] = [];
	let leftNo = 1;
	let rightNo = 1;
	let added = 0;
	let removed = 0;

	const pushRow = (left: SideCell, right: SideCell) => {
		built.push({
			row: {kind: 'line', left, right},
			changed: left.type === 'removed' || right.type === 'added',
		});
	};

	let index = 0;
	while (index < parts.length) {
		const part = parts[index]!;
		if (part.added) {
			const lines = splitLines(part.value);
			added += lines.length;
			for (const line of lines) {
				pushRow(
					{lineNo: null, text: '', type: 'empty'},
					{lineNo: rightNo++, text: line, type: 'added'},
				);
			}
			index++;
			continue;
		}
		if (part.removed) {
			// Pair with a following added part row-by-row when present.
			const next = parts[index + 1];
			const removedLines = splitLines(part.value);
			removed += removedLines.length;
			if (next && next.added) {
				const addedLines = splitLines(next.value);
				added += addedLines.length;
				const paired = Math.max(removedLines.length, addedLines.length);
				for (let i = 0; i < paired; i++) {
					const leftCell: SideCell =
						i < removedLines.length
							? {lineNo: leftNo++, text: removedLines[i]!, type: 'removed'}
							: {lineNo: null, text: '', type: 'empty'};
					const rightCell: SideCell =
						i < addedLines.length
							? {lineNo: rightNo++, text: addedLines[i]!, type: 'added'}
							: {lineNo: null, text: '', type: 'empty'};
					pushRow(leftCell, rightCell);
				}
				index += 2;
				continue;
			}
			for (const line of removedLines) {
				pushRow(
					{lineNo: leftNo++, text: line, type: 'removed'},
					{lineNo: null, text: '', type: 'empty'},
				);
			}
			index++;
			continue;
		}
		// unchanged
		const lines = splitLines(part.value);
		for (const line of lines) {
			pushRow(
				{lineNo: leftNo++, text: line, type: 'same'},
				{lineNo: rightNo++, text: line, type: 'same'},
			);
		}
		index++;
	}

	const rows = collapseToHunks(built);
	let firstChangeIndex = rows.findIndex(
		row =>
			row.kind === 'line' &&
			(row.left.type === 'removed' || row.right.type === 'added'),
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
