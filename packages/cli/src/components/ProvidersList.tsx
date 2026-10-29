import React from 'react';
import {Box, Text} from 'ink';
import {ProvidersEnum} from '@baby-panda/types';
export function ProvidersList() {
	const availableProviders = Object.values(ProvidersEnum);
	return (
		<Box height="100%" width="100%" flexDirection={'column'}>
			{availableProviders.map(provider => (
				<Box key={provider} width="100%">
					<Text>{provider}</Text>
				</Box>
			))}
		</Box>
	);
}
