import React from 'react';
import {Box, Text, useInput} from 'ink';
import type {ProviderInfo} from '../services/requests';
import {InlineInput} from './promptBox';
import {useTerminal} from '../hooks/useTerminal';
import {getInputColumnWidth} from '../layout';
import {MENU_COMMAND, MENU_DESCRIPTION, MENU_ROW_HIGHLIGHT} from '../theme';
import {
	buildSlashMenuLayout,
	padEndToWidth,
	resolveSlashMenuWindow,
	type SlashMenuEntry,
	type SlashMenuRow,
} from '../utils/slashMenuLayout';

/**
 * The slash-command menu: one entry per command or skill, the name you type on
 * the left and the sentence explaining it on the right, with the highlighted
 * entry tinted across its full width.
 *
 * A description that does not fit on its row wraps onto the rows below it,
 * indented to the description column, so nothing is cut off. An entry therefore
 * owns as many terminal rows as its description needs.
 *
 * It sits directly under the prompt box, whose bottom rule separates the two,
 * and it owns up/down/enter while it is open — the prompt box keeps only the
 * keystrokes that filter the list.
 */
export function SlashCommandMenu({
	items,
	onSelect,
	limit,
	width: widthProp,
	isFocused = true,
}: {
	items: SlashMenuEntry[];
	onSelect: (value: string) => void;
	/** Terminal rows the menu may occupy; defaults to the whole list. */
	limit?: number;
	/**
	 * Terminal columns the menu occupies. Defaults to the input column width,
	 * which is what every full-width menu wants; a menu drawn inside a border
	 * passes the width its host leaves it.
	 */
	width?: number;
	/** When false the menu stops listening, so another component can own input. */
	isFocused?: boolean;
}) {
	const terminal = useTerminal();
	const width = widthProp ?? getInputColumnWidth(terminal.columns);
	const rowBudget = Math.max(1, limit ?? Number.MAX_SAFE_INTEGER);

	// A filtered list is a different list, so the highlight starts at its top
	// again. Keeping the list beside the index is what tells the two apart
	// without an effect that would fight the keystroke that caused the change.
	const [selection, setSelection] = React.useState({items, index: 0});
	const selectedIndex = selection.items === items ? selection.index : 0;

	const layout = React.useMemo(
		() => buildSlashMenuLayout(items, width),
		[items, width],
	);

	// Only the entries that fit in the row budget are drawn, and the window
	// follows the highlight so a long list stays reachable from either end.
	const window = React.useMemo(
		() => resolveSlashMenuWindow(layout.rowHeights, selectedIndex, rowBudget),
		[layout.rowHeights, selectedIndex, rowBudget],
	);

	// The step is applied to the stored index rather than the one this render
	// closed over: two arrow keys arriving in the same tick must move the
	// highlight twice, not once.
	const move = React.useCallback(
		(delta: number) => {
			setSelection(current => {
				const index = current.items === items ? current.index : 0;
				return {items, index: (index + delta + items.length) % items.length};
			});
		},
		[items],
	);

	useInput(
		(_input, key) => {
			if (key.upArrow) {
				move(-1);
				return;
			}

			if (key.downArrow) {
				move(1);
				return;
			}

			if (key.return) {
				const item = items[selectedIndex];
				if (item) onSelect(item.value);
			}
		},
		{isActive: isFocused},
	);

	return (
		<Box flexDirection="column" width={width} flexShrink={0}>
			{layout.rows.slice(window.start, window.end).map((row, offset) => (
				<React.Fragment key={row.value}>
					<SlashMenuEntry
						row={row}
						nameWidth={layout.nameWidth}
						width={width}
						isSelected={window.start + offset === selectedIndex}
					/>
				</React.Fragment>
			))}
		</Box>
	);
}

/**
 * One entry: its first row carries the name, and every row after it is indented
 * to the description column so the wrapped lines read as one block.
 */
function SlashMenuEntry({
	row,
	nameWidth,
	width,
	isSelected,
}: {
	row: SlashMenuRow;
	nameWidth: number;
	width: number;
	isSelected: boolean;
}) {
	return (
		<>
			{row.descriptionLines.map((line, lineIndex) => (
				<Box
					key={lineIndex}
					width={width}
					height={1}
					flexShrink={0}
					backgroundColor={isSelected ? MENU_ROW_HIGHLIGHT : undefined}
				>
					{lineIndex === 0 ? (
						<Text color={MENU_COMMAND} bold={isSelected}>
							{padEndToWidth(row.name, nameWidth)}
						</Text>
					) : (
						<Text>{' '.repeat(nameWidth)}</Text>
					)}
					<Text color={MENU_DESCRIPTION}>{line}</Text>
				</Box>
			))}
		</>
	);
}

export function ProviderSetupBox({
	provider,
	onSubmit,
	changeMode = false,
}: {
	provider: ProviderInfo;
	onSubmit: (key: string) => void;
	/** True when replacing an already-saved key instead of the first setup. */
	changeMode?: boolean;
}) {
	const [key, setKey] = React.useState('');
	return (
		<Box flexDirection="column" paddingX={1} paddingTop={1}>
			<Text color="#f0c674">
				{changeMode
					? `Enter a new ${provider.provider} API key to replace the saved one`
					: `${provider.provider} API key is required to start BabyPanda`}
			</Text>
			{changeMode && (
				<Text dimColor>
					Press escape to cancel — the saved key stays in place.
				</Text>
			)}
			<InlineInput
				value={key}
				placeholder="Paste your API key and press enter"
				onChange={setKey}
				onSubmit={() => {
					if (key.trim()) onSubmit(key.trim());
				}}
			/>
		</Box>
	);
}

/**
 * Optional Exa credential prompt. Unlike the provider key this one can be
 * skipped: web search is a convenience, not a requirement to run, so the copy
 * says plainly what stops working and how to come back to it later.
 */
export function WebApiKeyBox({
	onSubmit,
	changeMode = false,
}: {
	onSubmit: (key: string) => void;
	/** True when replacing an already-saved key instead of adding the first one. */
	changeMode?: boolean;
}) {
	const [key, setKey] = React.useState('');
	return (
		<Box flexDirection="column" paddingX={1} paddingTop={1}>
			<Text color="#f0c674">
				{changeMode
					? 'Enter a new Exa API key to replace the saved one'
					: 'Add an Exa API key to enable web search? (optional)'}
			</Text>
			<Text dimColor>
				{changeMode
					? 'Press escape to cancel — the saved key stays in place.'
					: 'Without it the agent cannot use web_search or get_web_page. Press escape to skip — you can add it later with /web-api-keys.'}
			</Text>
			<InlineInput
				value={key}
				placeholder="Paste your Exa API key and press enter"
				onChange={setKey}
				onSubmit={() => {
					if (key.trim()) onSubmit(key.trim());
				}}
			/>
		</Box>
	);
}
