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
