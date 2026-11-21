import React, {useCallback, useEffect, useState} from 'react';
import {Box, Text, useInput} from 'ink';

interface SelectItem {
	label: string;
	value: string;
}

interface CustomSelectProps {
	title: string;
	items: SelectItem[];
	onSelect: (value: string) => void;
	limit?: number;
	/** When false the menu stops listening, so another component can own input. */
	isFocused?: boolean;
}

/**
 * A minimal, dependency-free replacement for `ink-select-input`'s
 * `SelectInput`.
 *
 * `ink-select-input` crashes inside compiled Bun binaries with
 * `TypeError: undefined is not an object (evaluating 'i.value')` when
 * arrow-key navigation desyncs its internal selected index from the
 * items array. This component manages its own index with bounds
 * checking and never reads `.value` from an undefined item.
 */
export function CustomSelect({
	title,
	items,
	onSelect,
	limit = 10,
	isFocused = true,
}: CustomSelectProps) {
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [isMounted, setIsMounted] = useState(false);

	// Clamp selectedIndex when the items array changes size.
	useEffect(() => {
		if (items.length === 0) {
			setSelectedIndex(0);
		} else if (selectedIndex >= items.length) {
			setSelectedIndex(items.length - 1);
		}
	}, [items.length, selectedIndex]);

	useEffect(() => {
		setIsMounted(true);
	}, []);

	const handleInput = useCallback(
		(input: string, key: {upArrow?: boolean; downArrow?: boolean}) => {
			if (!isFocused || !isMounted || items.length === 0) return;

			if (key.upArrow) {
				setSelectedIndex(prev => (prev > 0 ? prev - 1 : items.length - 1));
			} else if (key.downArrow) {
				setSelectedIndex(prev => (prev < items.length - 1 ? prev + 1 : 0));
			} else if (input === '\r' || input === '\n') {
				const selected = items[selectedIndex];
				if (selected) {
					onSelect(selected.value);
				}
			}
		},
		[items, onSelect, selectedIndex, isFocused, isMounted],
	);

	useInput(handleInput);

	const visibleItems = items.slice(0, limit);

	return (
		<Box flexDirection="column" paddingX={1} paddingTop={1}>
			<Text color="#ffffff">{title}</Text>
			{visibleItems.map((item, index) => (
				<Box key={item.value} flexDirection="row" marginTop={0.5}>
					<Text>{index === selectedIndex ? '▸ ' : '  '}</Text>
					<Text color={index === selectedIndex ? '#60a5fa' : '#ffffff'}>
						{item.label}
					</Text>
				</Box>
			))}
			{items.length === 0 && <Text dimColor>(no options)</Text>}
		</Box>
	);
}
