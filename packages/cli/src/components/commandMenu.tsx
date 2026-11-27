import React from 'react';
import {Box, Text, useInput} from 'ink';
import SelectInput from 'ink-select-input';
import type {ProviderInfo} from '../services/requests';
import {InlineInput} from './promptBox';
import {useTerminal} from '../hooks/useTerminal';
import {getInputColumnWidth} from '../layout';
import {MENU_COMMAND, MENU_DESCRIPTION, MENU_ROW_HIGHLIGHT} from '../theme';
import {
	buildSlashMenuLayout,
	padEndToWidth,
	type SlashMenuEntry,
	type SlashMenuRow,
} from '../utils/slashMenuLayout';

/**
 * The slash-command menu: one row per command or skill, the name you type on
 * the left and the sentence explaining it on the right, with the highlighted
 * row tinted across its full width.
 *
 * It sits directly under the prompt box, whose bottom rule separates the two,
 * and it owns up/down/enter while it is open — the prompt box keeps only the
 * keystrokes that filter the list.
 */
export function SlashCommandMenu({
	items,
	onSelect,
	limit,
	isFocused = true,
}: {
	items: SlashMenuEntry[];
	onSelect: (value: string) => void;
	limit?: number;
	/** When false the menu stops listening, so another component can own input. */
	isFocused?: boolean;
}) {
	const terminal = useTerminal();
	const width = getInputColumnWidth(terminal.columns);
	const visibleCount = Math.max(
		1,
		Math.min(items.length, limit ?? items.length),
	);

	// A filtered list is a different list, so the highlight starts at its top
	// again. Keeping the list beside the index is what tells the two apart
	// without an effect that would fight the keystroke that caused the change.
	const [selection, setSelection] = React.useState({items, index: 0});
	const selectedIndex = selection.items === items ? selection.index : 0;

	const layout = React.useMemo(
		() => buildSlashMenuLayout(items, width),
		[items, width],
	);

	// Keep the highlighted row on screen, centred once the list is longer than
	// the window so stepping down never looks like the list jumped.
	const windowTop = Math.max(
		0,
		Math.min(
			selectedIndex - Math.floor(visibleCount / 2),
			items.length - visibleCount,
		),
	);
	const visibleRows = layout.rows.slice(windowTop, windowTop + visibleCount);

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
			{visibleRows.map((row, index) => (
				<SlashMenuRow
					key={row.value}
					row={row}
					nameWidth={layout.nameWidth}
					width={width}
					isSelected={windowTop + index === selectedIndex}
				/>
			))}
		</Box>
	);
}

function SlashMenuRow({
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
		<Box
			width={width}
			height={1}
			flexShrink={0}
			backgroundColor={isSelected ? MENU_ROW_HIGHLIGHT : undefined}
		>
			<Text color={MENU_COMMAND} bold={isSelected}>
				{padEndToWidth(row.name, nameWidth)}
			</Text>
			<Text color={MENU_DESCRIPTION}>{row.description}</Text>
		</Box>
	);
}

export function CommandMenu({
	title,
	items,
	onSelect,
	limit,
	isFocused = true,
}: {
	title: string;
	items: Array<{label: string; value: string}>;
	onSelect: (value: string) => void;
	limit?: number;
	/** When false the menu stops listening, so another component can own input. */
	isFocused?: boolean;
}) {
	return (
		<Box flexDirection="column" paddingX={1} paddingTop={1}>
			<Text color="#ffffff">{title}</Text>
			<SelectInput
				items={items}
				limit={limit}
				isFocused={isFocused}
				onSelect={item => onSelect(item.value)}
			/>
		</Box>
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
