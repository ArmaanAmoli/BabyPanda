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
			<Text color="#9fe3bd">{title}</Text>
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
