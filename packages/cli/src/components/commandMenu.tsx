import React from 'react';
import {Box, Text} from 'ink';
import SelectInput from 'ink-select-input';
import type {ProviderInfo} from '../services/requests';
import {InlineInput} from './promptBox';

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
}: {
	provider: ProviderInfo;
	onSubmit: (key: string) => void;
}) {
	const [key, setKey] = React.useState('');
	return (
		<Box flexDirection="column" paddingX={1} paddingTop={1}>
			<Text color="#f0c674">
				{provider.provider} API key is required to start BabyPanda
			</Text>
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
export function WebApiKeyBox({onSubmit}: {onSubmit: (key: string) => void}) {
	const [key, setKey] = React.useState('');
	return (
		<Box flexDirection="column" paddingX={1} paddingTop={1}>
			<Text color="#f0c674">
				Add an Exa API key to enable web search? (optional)
			</Text>
			<Text dimColor>
				Without it the agent cannot use web_search or get_web_page. Press escape
				to skip — you can add it later with /web-api-keys.
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
