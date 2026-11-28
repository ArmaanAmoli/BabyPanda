/**
 * Colour tokens for the terminal UI.
 *
 * Red and green are reserved for exactly two meanings: tool-call status (the
 * bullet dot) and diff information. Everywhere else uses neutrals, so a green
 * or red pixel always answers "did this succeed?" or "was this line added?".
 *
 * The sandbox badge and clipboard toast deliberately keep their own lighter
 * palette and are not defined here.
 */

/** Tool-call status. Yellow also covers "waiting for permission". */
export const STATUS_RUNNING = '#ffe100';
export const STATUS_DONE = '#73bc59';
export const STATUS_FAILED = '#d65851';

/** Primary text: tool verbs, prompt cursor, skill glyph, menu titles. */
export const TEXT_WHITE = '#ffffff';

/**
 * Reasoning glyph accent, shared by the streaming spinner and the `∴` marker
 * that replaces it, so the glyph reads as one element across the transition.
 */
export const REASONING_ACCENT = '#863737';

/** Assistant message glyph. */
export const ASSISTANT_GLYPH = '#7e7474';

/** Horizontal rules above and below the prompt box and around user messages. */
export const RULE_COLOR = '#555555';

/**
 * Diff information. The backgrounds are the status colours pre-blended into
 * dark tints: chalk silently discards the alpha channel of an 8-digit hex, so
 * "transparent" has to be baked in. The blends below are the user-chosen
 * tints (a 25% blend was still too subtle on the target display).
 */
export const DIFF_ADDED_TEXT = STATUS_DONE;
export const DIFF_REMOVED_TEXT = STATUS_FAILED;
export const DIFF_ADDED_BACKGROUND = '#182819';
export const DIFF_REMOVED_BACKGROUND = '#271617';

/**
 * Slash-menu accents. This is the one place a hue is used outside the status
 * palette: a menu row has two halves that must read differently at a glance —
 * the name you type and the sentence explaining it — and a neutral pair does
 * not separate them.
 */

/** Slash-menu command or skill name. */
export const MENU_COMMAND = '#6cb6ff';

/** Slash-menu description, the explanatory half of the row. */
export const MENU_DESCRIPTION = '#9a9a9a';

/** Full-width tint behind the highlighted slash-menu row. */
export const MENU_ROW_HIGHLIGHT = '#1b2836';

/**
 * Border of the permission prompt. It is the one modal surface in the UI — the
 * only thing that takes the keyboard away from the prompt box — so it is drawn
 * as a box rather than a rule, and in the accent hue rather than the neutral
 * rule colour.
 */
export const PERMISSION_BORDER = '#4f7fb5';
