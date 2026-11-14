import React, {useEffect, useState} from 'react';
import {Box, Text} from 'ink';

/**
 * Braille spinner frames, shared by the bottom status line and the reasoning
 * block's live glyph. One animation vocabulary for the whole app.
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

interface LodingIndicatorProp {
	isResponding: boolean;
	isCompacting?: boolean;
}

/**
 * Bottom status line. The app only mounts this while compaction is running;
 * thinking is signalled by the spinner on the reasoning block itself.
 */
export function LodingIndicator({
	isResponding,
	isCompacting = false,
}: LodingIndicatorProp) {
	const frame = useSpinnerFrame(isResponding);

	if (!isResponding) {
		return null;
	}

	return (
		<Box>
			<Text color="white">
				{SPINNER_FRAMES[frame]} {isCompacting ? 'Compacting...' : 'Thinking...'}
			</Text>
		</Box>
	);
}