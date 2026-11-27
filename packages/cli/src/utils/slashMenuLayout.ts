import {getDisplayWidth} from './promptLayout';

/**
 * Layout maths for the slash-command menu.
 *
 * The menu is a two-column list: the name you type on the left, the sentence
 * explaining it on the right. Both columns are measured in terminal columns
 * and cut here rather than left to Ink, so one entry is always exactly one
 * terminal row and the app can reserve the right number of rows for the whole
 * menu before it renders.
 */

/** One entry in the slash menu. */
export interface SlashMenuEntry {
	/** Command or skill name, without the leading slash. */
	name: string;
	/** One-line explanation shown to the right of the name. */
	description: string;
	/** Payload handed back to the app when the row is chosen. */
	value: string;
}

/** One rendered row, with both columns already cut to the available width. */
export interface SlashMenuRow {
	value: string;
	name: string;
	description: string;
}

export interface SlashMenuLayout {
	/** Terminal columns the name column occupies, gap included. */
	nameWidth: number;
	rows: SlashMenuRow[];
}

/** Marks a cut, so a truncated row never silently loses its tail. */
const ELLIPSIS = '…';

/** Columns of air between the name column and the description. */
const NAME_COLUMN_GAP = 2;

/** Widest the name column grows, so one long skill name cannot own the row. */
const NAME_COLUMN_MAX = 26;

/** Share of the row the description keeps even on a narrow terminal. */
const DESCRIPTION_SHARE = 0.4;

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
		1,
		Math.floor(availableWidth * (1 - DESCRIPTION_SHARE)),
	);

	return Math.max(
		1,
		Math.min(longest + NAME_COLUMN_GAP, NAME_COLUMN_MAX, ceiling),
	);
}

/**
 * Cuts every entry to the row width. The name column is shared by all rows so
 * the descriptions line up, which is what makes the list scannable.
 */
export function buildSlashMenuLayout(
	entries: readonly SlashMenuEntry[],
	availableWidth: number,
): SlashMenuLayout {
	const nameWidth = resolveNameColumnWidth(entries, availableWidth);
	const descriptionWidth = Math.max(0, availableWidth - nameWidth);

	return {
		nameWidth,
		rows: entries.map(entry => ({
			value: entry.value,
			name: truncateToWidth(entry.name, nameWidth),
			description: truncateToWidth(entry.description, descriptionWidth),
		})),
	};
}

/**
 * Rows the menu occupies. One per visible entry and nothing else: the rule
 * above it belongs to the prompt box, so the menu must not reserve a row for
 * a title or padding of its own.
 */
export function getSlashMenuHeight(entryCount: number, limit: number): number {
	return Math.max(0, Math.min(entryCount, limit));
}
