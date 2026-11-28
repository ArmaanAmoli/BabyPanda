import {getDisplayWidth, wrapText} from './promptLayout';

/**
 * Layout maths for the slash-command menu.
 *
 * The menu is a two-column list: the name you type on the left, the sentence
 * explaining it on the right. A description that does not fit on its row wraps
 * onto the rows below it, indented to the description column, rather than being
 * cut — a truncated explanation is worse than a taller one.
 *
 * Everything is measured in terminal columns and wrapped here rather than left
 * to Ink, so one entry occupies a known number of rows and the app can reserve
 * exactly that many before the menu renders.
 */

/** One entry in the slash menu. */
export interface SlashMenuEntry {
	/** Command or skill name, without the leading slash. */
	name: string;
	/** Explanation shown to the right of the name; wraps as needed. */
	description: string;
	/** Payload handed back to the app when the row is chosen. */
	value: string;
}

/** One entry laid out for rendering. */
export interface SlashMenuRow {
	value: string;
	/** Name column text, already cut to the name column width. */
	name: string;
	/** Description lines, each already cut to the description width. */
	descriptionLines: string[];
}

export interface SlashMenuLayout {
	/** Terminal columns the name column occupies, gap included. */
	nameWidth: number;
	rows: SlashMenuRow[];
	/** Terminal rows each entry occupies, indexed like `rows`. */
	rowHeights: number[];
}

/** Half-open range of entries a window shows. */
export interface SlashMenuWindow {
	start: number;
	end: number;
}

/** Marks a cut, so a truncated row never silently loses its tail. */
const ELLIPSIS = '…';

/** Columns of air between the name column and the description. */
const NAME_COLUMN_GAP = 2;

/** Widest the name column grows, so one long skill name cannot own the row. */
const NAME_COLUMN_MAX = 26;

/** Share of the row the name column may take before the description wraps. */
const NAME_COLUMN_SHARE = 0.5;

/**
 * Cuts `text` to at most `width` terminal columns, appending an ellipsis when
 * something was dropped. Width is measured rather than counted, so a wide
 * character or an emoji cannot push a row past the terminal edge.
 */
export function truncateToWidth(text: string, width: number): string {
	if (width <= 0) return '';
	if (getDisplayWidth(text) <= width) return text;

	const ellipsisWidth = getDisplayWidth(ELLIPSIS);
	if (width <= ellipsisWidth) return ELLIPSIS.slice(0, width);

	let result = '';
	let used = 0;
	for (const character of text) {
		const characterWidth = getDisplayWidth(character);
		if (used + characterWidth > width - ellipsisWidth) break;
		result += character;
		used += characterWidth;
	}

	return result + ELLIPSIS;
}

/** Pads `text` with spaces to exactly `width` terminal columns. */
export function padEndToWidth(text: string, width: number): string {
	const padding = width - getDisplayWidth(text);
	return padding > 0 ? text + ' '.repeat(padding) : text;
}

/**
 * Columns the name column occupies: the longest name plus its gap, capped so
 * the description keeps its share of a narrow terminal.
 *
 * The gap is reserved before the cap is applied, so a name long enough to fill
 * the column still leaves air between it and the description instead of running
 * straight into it.
 */
export function resolveNameColumnWidth(
	entries: readonly SlashMenuEntry[],
	availableWidth: number,
): number {
	const longest = entries.reduce(
		(widest, entry) => Math.max(widest, getDisplayWidth(entry.name)),
		0,
	);
	const ceiling = Math.max(
		NAME_COLUMN_GAP + 1,
		Math.floor(availableWidth * NAME_COLUMN_SHARE) - NAME_COLUMN_GAP,
	);
	const nameTextWidth = Math.max(
		1,
		Math.min(longest, NAME_COLUMN_MAX, ceiling),
	);

	return nameTextWidth + NAME_COLUMN_GAP;
}

/**
 * Lays every entry out for rendering. The name column is shared by all entries
 * so the descriptions line up, which is what makes the list scannable, and each
 * description is wrapped to the columns that are left.
 */
export function buildSlashMenuLayout(
	entries: readonly SlashMenuEntry[],
	availableWidth: number,
): SlashMenuLayout {
	const nameWidth = resolveNameColumnWidth(entries, availableWidth);
	const descriptionWidth = Math.max(1, availableWidth - nameWidth);

	const rows = entries.map(entry => {
		const descriptionLines = wrapText(entry.description, descriptionWidth).map(
			line => line.text,
		);

		return {
			value: entry.value,
			name: truncateToWidth(entry.name, nameWidth),
			// An empty description still owns its row: the name has to sit on a
			// row of its own rather than disappearing.
			descriptionLines: descriptionLines.length > 0 ? descriptionLines : [''],
		};
	});

	return {
		nameWidth,
		rows,
		rowHeights: rows.map(row => row.descriptionLines.length),
	};
}

/**
 * Terminal rows the menu occupies: every entry's wrapped lines, capped at the
 * row budget. The app reserves this before rendering, so the chat area and the
 * menu can never disagree about how tall the menu is.
 */
export function getSlashMenuHeight(
	entries: readonly SlashMenuEntry[],
	availableWidth: number,
	limit: number,
): number {
	const {rowHeights} = buildSlashMenuLayout(entries, availableWidth);
	const total = rowHeights.reduce((sum, height) => sum + height, 0);
	return Math.max(0, Math.min(total, limit));
}

/**
 * Picks the entries that fit inside `limit` terminal rows, keeping
 * `selectedIndex` on screen.
 *
 * The window grows downwards from the selection until the budget is spent, then
 * upwards, so the highlighted row is never below the fold and a list longer
 * than the budget stays reachable from either direction.
 */
export function resolveSlashMenuWindow(
	rowHeights: readonly number[],
	selectedIndex: number,
	limit: number,
): SlashMenuWindow {
	const budget = Math.max(0, limit);
	const lastIndex = rowHeights.length - 1;
	if (budget === 0 || lastIndex < 0) return {start: 0, end: 0};

	const selected = Math.max(0, Math.min(selectedIndex, lastIndex));
	let start = selected;
	let end = selected + 1;
	let used = rowHeights[selected] ?? 0;

	while (end < rowHeights.length && used + rowHeights[end]! <= budget) {
		used += rowHeights[end]!;
		end += 1;
	}

	while (start > 0 && used + rowHeights[start - 1]! <= budget) {
		start -= 1;
		used += rowHeights[start]!;
	}

	return {start, end};
}
