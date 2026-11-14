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

export const APP_BACKGROUND_COLOR = '#141414';

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

/** Full-width band behind a user message, a neutral grey step above the background. */
export const USER_BAND_BACKGROUND = '#2a2a2a';

/** Focused or hovered row. */
export const HIGHLIGHT_BACKGROUND = '#242424';

/**
 * Diff information. The backgrounds are the status colours pre-blended against
 * APP_BACKGROUND_COLOR: chalk silently discards the alpha channel of an
 * 8-digit hex, so "transparent" has to be baked in. The blends below are the
 * user-chosen tints (a 25% blend was still too subtle on the target display).
 */
export const DIFF_ADDED_TEXT = STATUS_DONE;
export const DIFF_REMOVED_TEXT = STATUS_FAILED;
export const DIFF_ADDED_BACKGROUND = '#182819';
export const DIFF_REMOVED_BACKGROUND = '#271617';
