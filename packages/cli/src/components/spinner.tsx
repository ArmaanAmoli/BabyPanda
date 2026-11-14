import {useEffect, useState} from 'react';

/**
 * Braille spinner frames, shared by every live indicator: the reasoning
 * block's glyph and the status bar's responding/compaction label. One
 * animation vocabulary for the whole app.
 */
export const SPINNER_FRAMES = [
	'⠋',
	'⠙',
	'⠹',
	'⠸',
	'⠼',
	'⠴',
	'⠦',
	'⠧',
	'⠇',
	'⠏',
];

/** Milliseconds per spinner frame. */
export const SPINNER_INTERVAL_MS = 100;

/**
 * Advances the spinner while `active` and rests on the first frame otherwise,
 * so a stopped spinner always reads as frame 0 rather than wherever it stopped.
 */
export function useSpinnerFrame(active: boolean): number {
	const [frame, setFrame] = useState(0);

	useEffect(() => {
		if (!active) {
			setFrame(0);
			return;
		}

		const interval = setInterval(() => {
			setFrame(previousFrame => (previousFrame + 1) % SPINNER_FRAMES.length);
		}, SPINNER_INTERVAL_MS);

		return () => {
			clearInterval(interval);
		};
	}, [active]);

	return frame;
}
