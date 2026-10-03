import React, {useEffect, useState} from 'react';
import usePendingPermissionMessages from '../hooks/usePendingPermissionMessages';
import {Box, Text} from 'ink';
import useSocket from '../hooks/useSocket';
import SelectInput, {Item} from 'ink-select-input';

interface Item {
	label: string;
	value: boolean;
}

export function PermissionBox() {
	const {pendingPermissionMessages, setPendingPermissionMessages} =
		usePendingPermissionMessages();
	const socket = useSocket();
	const [allowed, setAllowed] = useState(false);
	const handleSelect = (item: Item) => {
		setAllowed(item.value);
	};
	const items: Item[] = [
		{
			label: 'Allow',
			value: true,
		},
		{
			label: "Don't Allow",
			value: false,
		},
	];
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
					<SelectInput items={items} onSelect={handleSelect} />
				</Box>
			)}
		</>
	);
}
