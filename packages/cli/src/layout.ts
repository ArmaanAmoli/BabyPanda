/**
 * Layout constants shared by the app shell and its components.
 *
 * These live apart from the app component so a component can size itself
 * without importing the whole app module graph (which reaches the server and
 * the database).
 */

/** Horizontal padding the app applies to its main column. */
export const PADDING_APP = 2;

/** Blank rows between the chat area and the prompt box. */
export const GAP_CHAT_BOX_PROMPT_BOX = 1;

/**
 * Blank rows between an open menu and the status bar.
 *
 * A menu's last row is often a wrapped continuation of a description, and
 * running it straight into the status line makes the two read as one block.
 */
export const GAP_MENU_STATUS_BAR = 1;

/**
 * Terminal columns the prompt box occupies: the app column less the one column
 * its scrollbar permanently reserves.
 *
 * The slash menu matches it so the rule above the menu and the highlighted row
 * below it end at the same column, instead of the menu hanging one column past
 * the box it belongs to.
 */
export function getInputColumnWidth(columns: number): number {
	return Math.max(10, columns - 2 * PADDING_APP - 1);
}
