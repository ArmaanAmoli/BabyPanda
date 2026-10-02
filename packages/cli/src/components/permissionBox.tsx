import React from 'react';
import usePendingPermissionMessages from '../hooks/usePendingPermissionMessages';
import {Box, Text} from 'ink';

export function PermissionBox() {
	const {pendingPermissionMessages, setPendingPermissionMessages} =
		usePendingPermissionMessages();
	return (
		<>
			{pendingPermissionMessages.length !== 0 && (
				<Box
					flexDirection="column"
					justifyContent="flex-start"
					alignItems="center"
				></Box>
			)}
		</>
	);
}
