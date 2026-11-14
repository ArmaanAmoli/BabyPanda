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

/** Full-width band behind a user message, one step above the background. */
export const USER_BAND_BACKGROUND = '#1b1b1f';

/** Focused or hovered row. */
export const HIGHLIGHT_BACKGROUND = '#242424';

/**
 * Diff information. The backgrounds are the status colours pre-blended against
 * APP_BACKGROUND_COLOR at 15%: chalk silently discards the alpha channel of an
 * 8-digit hex, so "transparent" has to be baked in.
 */
export const DIFF_TINT_RATIO = 0.15;
export const DIFF_ADDED_TEXT = STATUS_DONE;
export const DIFF_REMOVED_TEXT = STATUS_FAILED;
export const DIFF_ADDED_BACKGROUND = tintOverBackground(
	STATUS_DONE,
	DIFF_TINT_RATIO,
);
export const DIFF_REMOVED_BACKGROUND = tintOverBackground(
	STATUS_FAILED,
	DIFF_TINT_RATIO,
);

/** Blends `color` over APP_BACKGROUND_COLOR at `ratio` and returns a hex. */
export function tintOverBackground(color: string, ratio: number): string {
	const base = APP_BACKGROUND_COLOR;
	const channels = (hex: string) =>
		[1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
	const [br, bg, bb] = channels(base);
	const [cr, cg, cb] = channels(color);
	const mixed = [cr, cg, cb].map((value, index) =>
		Math.round(value * ratio + [br, bg, bb][index]! * (1 - ratio)),
	);
	return `#${mixed.map(value => value.toString(16).padStart(2, '0')).join('')}`;
}
