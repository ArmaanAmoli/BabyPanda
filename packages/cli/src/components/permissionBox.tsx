import React from 'react';
import {Box, Text, useInput} from 'ink';
import usePendingPermissionMessages from '../hooks/usePendingPermissionMessages';
import useSocket from '../hooks/useSocket';
import {useTerminal} from '../hooks/useTerminal';
import {
	PermissionsEnums,
	WsEventMessage,
	WsEventTypes,
} from '@baby-panda/types';
import {getDisplayWidth, wrapText} from '../utils/promptLayout';
import {getInputColumnWidth} from '../layout';
import {PERMISSION_BORDER} from '../theme';
import {SlashCommandMenu} from './commandMenu';
import {
	getSlashMenuHeight,
	type SlashMenuEntry,
} from '../utils/slashMenuLayout';

/**
 * The permission prompt.
 *
 * It is the one modal surface in the UI: while it is up the prompt box and the
 * command menu are hidden and nothing else may consume a keypress, so Enter here
 * can never also act on what they held. See `app.tsx`.
 *
 * The command sits in a full-width box with the options laid out by the same
 * two-column menu every other selection uses, so the three choices read like
 * the rest of the app instead of a bare list of verbs.
 */

/** Title on the box's top rule. */
const TITLE = 'Shell command';

/** Columns of air between the box's sides and its content. */
const BORDER_PADDING = 2;

/**
 * Rows the box spends on anything but the command and the options: the top
 * rule, the blank row under it, the blank row above the question, the question
 * itself, the blank row under the options, and the bottom rule.
 */
const BOX_CHROME_ROWS = 6;

/** The question above the options. */
const QUESTION = 'Do you want to proceed?';

const items: SlashMenuEntry[] = [
	{
		name: 'Allow',
		description: 'run this shell command once',
		value: 'allow',
	},
	{
		name: "Don't Allow",
		description: 'block this shell command',
		value: 'deny',
	},
	{
		name: 'Always Allow',
		description: 'run this and every later shell command',
		value: 'always',
	},
];

/** Columns the command and the options are laid out at, inside the box. */
export function getPermissionContentWidth(width: number): number {
	return Math.max(1, width - 2 - 2 * BORDER_PADDING);
}

/**
 * Rows the permission box needs: the command's wrapped lines, the options'
 * wrapped rows, and the box around them.
 */
export function getPermissionBoxHeight(content: string, width: number): number {
	const contentWidth = getPermissionContentWidth(width);
	const commandLines = wrapText(content, contentWidth).length;
	const optionRows = getSlashMenuHeight(
		items,
		contentWidth,
		Number.MAX_SAFE_INTEGER,
	);

	return commandLines + optionRows + BOX_CHROME_ROWS;
}

/** The "Don't Allow" decision for the newest pending permission. */
export function buildDenyMessage(toolCallId: string): WsEventMessage {
	return {
		eventType: WsEventTypes.permission,
		permission: PermissionsEnums.allowOnce,
		permissionGranted: false,
		toolCallId,
	};
}

/**
 * The app-level half of the modal behaviour.
 *
 * Ink calls every subscribed input handler — there is no way for one to stop
 * the others — so a permission prompt cannot make the rest of the tree stand
 * down by doing nothing. Two things have to happen instead: the prompt box and
 * the command menu are unmounted while it is up (see `app.tsx`), and this hook
 * takes the app's own keypresses so Tab, the chat shortcuts and the escape
 * handler cannot act on a tree the user is not looking at.
 *
 * Escape is the one key that still does something: it takes the same path as
 * "Don't Allow" on the newest prompt, which is the way out without deciding.
 */
export function usePermissionModal() {
	const {pendingPermissionMessages, setPendingPermissionMessages} =
		usePendingPermissionMessages();
	const socket = useSocket();
	const pending = pendingPermissionMessages.length > 0;

	useInput(
		(_input, key) => {
			if (!pending) return;

			if (key.escape) {
				const newest = pendingPermissionMessages.at(-1);
				if (!newest) return;

				socket?.send(JSON.stringify(buildDenyMessage(newest.toolCallId)));
				setPendingPermissionMessages(previous => previous.slice(0, -1));
			}
		},
		{isActive: pending},
	);
}

/** Top rule with the title set into it, as the reference layout does. */
function topRule(width: number): string {
	const label = ` ${TITLE} `;
	// Three columns are spent before the dashes start: the corner, the rule
	// under it, and the far corner. Getting this wrong by one makes the rule
	// wrap onto a second row and break the box open.
	const dashes = Math.max(0, width - 3 - getDisplayWidth(label));
	return `╭─${label}${'─'.repeat(dashes)}╮`;
}

function bottomRule(width: number): string {
	return `╰${'─'.repeat(Math.max(0, width - 2))}╯`;
}

export function PermissionBox() {
	const {pendingPermissionMessages, setPendingPermissionMessages} =
		usePendingPermissionMessages();
	const socket = useSocket();
	const terminal = useTerminal();
	const width = getInputColumnWidth(terminal.columns);
	const contentWidth = getPermissionContentWidth(width);

	const handleSelect = (value: string) => {
		const permissionObject = pendingPermissionMessages.at(-1);
		if (!permissionObject) return;

		const message: WsEventMessage =
			value === 'always'
				? {
						eventType: WsEventTypes.permission,
						permission: PermissionsEnums.allowAlways,
					}
				: {
						eventType: WsEventTypes.permission,
						permission: PermissionsEnums.allowOnce,
						permissionGranted: value === 'allow',
						toolCallId: permissionObject.toolCallId,
					};

		socket?.send(JSON.stringify(message));
		setPendingPermissionMessages(previous => previous.slice(0, -1));
	};

	const content = pendingPermissionMessages.at(-1)?.content ?? '';
	const commandLines = wrapText(content, contentWidth);

	return (
		<>
			{socket && pendingPermissionMessages.length !== 0 && (
				<Box flexDirection="column" width={width} height="100%">
					<Box height={1} flexShrink={0}>
						<Text color={PERMISSION_BORDER}>{topRule(width)}</Text>
					</Box>

					{/* Only the sides come from Ink: the top and bottom rules are
					    drawn by hand so the title can be set into the top one. */}
					<Box
						flexDirection="column"
						flexShrink={1}
						minHeight={1}
						borderStyle="round"
						borderTop={false}
						borderBottom={false}
						borderColor={PERMISSION_BORDER}
						paddingX={BORDER_PADDING}
					>
						<Box height={1} flexShrink={0}>
							<Text> </Text>
						</Box>

						{/* Shrinkable and clipped, so a long command can never push
						    the options or the box itself out of view. */}
						<Box
							flexDirection="column"
							flexShrink={1}
							minHeight={1}
							overflow="hidden"
						>
							{commandLines.map((line, index) => (
								<Text key={index}>{line.text}</Text>
							))}
						</Box>

						<Box height={1} flexShrink={0}>
							<Text> </Text>
						</Box>
						<Box height={1} flexShrink={0}>
							<Text dimColor>{QUESTION}</Text>
						</Box>
						<Box flexShrink={0}>
							<SlashCommandMenu
								items={items}
								width={contentWidth}
								onSelect={handleSelect}
							/>
						</Box>
						<Box height={1} flexShrink={0}>
							<Text> </Text>
						</Box>
					</Box>

					<Box height={1} flexShrink={0}>
						<Text color={PERMISSION_BORDER}>{bottomRule(width)}</Text>
					</Box>
				</Box>
			)}
		</>
	);
}
