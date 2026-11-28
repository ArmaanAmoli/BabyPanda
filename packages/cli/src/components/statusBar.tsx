import React from 'react';
import {Box, Text} from 'ink';
import {SPINNER_FRAMES} from './spinner';
import {STATUS_RUNNING, TEXT_WHITE} from '../theme';

/** Colour of the "web search is off" notice; matches the clipboard toast. */
const WEB_SEARCH_OFF_COLOR = '#f0c674';

/** Leading space separates the notice from the model details before it. */
const WEB_SEARCH_OFF_NOTICE = ' · web search off (/web-api-keys)';

export interface StatusBarProps {
	sessionId: string;
	/**
	 * The session's label. Empty until it has been read from the database,
	 * in which case the row simply carries no label.
	 */
	sessionName: string;
	provider: string;
	model: string;
	reasoningEffort: string;
	contextWindow: number;
	contextWindowUsed: number;
	/** A response is streaming, so the spinner and activity label are shown. */
	responding: boolean;
	spinnerFrame: number;
	statusLabel: string;
	/** No Exa key is saved, so the web tools stay unavailable. */
	webSearchOff: boolean;
}

function contextUsedPercent(
	contextWindow: number,
	contextWindowUsed: number,
): number {
	if (!contextWindow) {
		return 0;
	}
	return Math.round((contextWindowUsed / contextWindow) * 100);
}

/**
 * The single row under the prompt: what the session is, which model answers
 * it, and how much context is left.
 *
 * The session's label sits directly after its id, separated by the same dot
 * the rest of the row uses, so the two identifiers read as one unit before the
 * model details. When the terminal is too narrow for the whole row, the tail
 * is what goes — never the label.
 */
export function StatusBar({
	sessionId,
	sessionName,
	provider,
	model,
	reasoningEffort,
	contextWindow,
	contextWindowUsed,
	responding,
	spinnerFrame,
	statusLabel,
	webSearchOff,
}: StatusBarProps) {
	return (
		<Box height={1} paddingX={1}>
			{responding && (
				<>
					<Text color={STATUS_RUNNING}>{SPINNER_FRAMES[spinnerFrame]} </Text>
					<Text dimColor>{statusLabel} · </Text>
				</>
			)}
			<Text dimColor>
				Session {sessionId}
				{sessionName !== '' && ' · '}
				{sessionName !== '' && <Text color={TEXT_WHITE}>{sessionName}</Text>}
				{' · '}
				{provider} · {model} · effort: {reasoningEffort} ·{' '}
				{contextWindow.toLocaleString()} context ·{' '}
				{contextUsedPercent(contextWindow, contextWindowUsed)}% used
			</Text>
			{webSearchOff && (
				<Text color={WEB_SEARCH_OFF_COLOR}>{WEB_SEARCH_OFF_NOTICE}</Text>
			)}
		</Box>
	);
}
