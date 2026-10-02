import React, {useEffect, useState} from 'react';
import usePendingPermissionMessages from '../hooks/usePendingPermissionMessages';
import {Box, Text} from 'ink';
import useSocket from '../hooks/useSocket';
import {Button} from './button';

export function PermissionBox() {
	const {pendingPermissionMessages, setPendingPermissionMessages} =
		usePendingPermissionMessages();
	const socket = useSocket();
	const [allowed, setAllowed] = useState(false);
	useEffect(() => {
		const permissionObject = pendingPermissionMessages.at(
			pendingPermissionMessages.length - 1,
		);
		if (permissionObject) {
			permissionObject.permission = allowed;
			socket?.send(JSON.stringify(permissionObject));
			setPendingPermissionMessages(prev => prev.slice(0, -1));
			setAllowed(false);
		}
	}, [allowed]);
	return (
		<>
			{socket && pendingPermissionMessages.length !== 0 && (
				<Box
					flexDirection="column"
					justifyContent="flex-start"
					alignItems="center"
				>
					<Text>
						{
							pendingPermissionMessages[pendingPermissionMessages.length - 1]
								.content
						}
					</Text>
					<Box flexDirection="row">
						<Button
							label="Allow"
							onPress={() => {
								setAllowed(true);
							}}
						/>
						<Button
							label="Don't Allow"
							onPress={() => {
								setAllowed(false);
							}}
						/>
					</Box>
				</Box>
			)}
		</>
	);
}
