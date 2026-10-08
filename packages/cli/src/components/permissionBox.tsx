import React from 'react';
import usePendingPermissionMessages from '../hooks/usePendingPermissionMessages';
import {Box, Text} from 'ink';
import useSocket from '../hooks/useSocket';
import SelectInput, {Item} from 'ink-select-input';
import {
	LogType,
	PermissionsEnums,
	WsEventMessage,
	WsEventTypes,
} from '@baby-panda/types';
import {writeLogs, getProjectName} from '@baby-panda/utils';
import {useSession} from '../hooks/useSession';

interface Item {
	label: string;
	value: boolean;
}

export function PermissionBox() {
	const session = useSession();
	const {pendingPermissionMessages, setPendingPermissionMessages} =
		usePendingPermissionMessages();
	const socket = useSocket();
	const handleSelect = (item: Item) => {
		send(item);
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
		{
			label: 'Always Allow',
			value: true,
		},
	];
	const send = (item: Item) => {
		const permissionObject = pendingPermissionMessages.at(
			pendingPermissionMessages.length - 1,
		);
		if (permissionObject) {
			const message: WsEventMessage =
				item.label === 'Always Allow'
					? {
							eventType: WsEventTypes.permission,
							permission: PermissionsEnums.allowAlways,
						}
					: {
							eventType: WsEventTypes.permission,
							permission: PermissionsEnums.allowOnce,
							permissionGranted: item.value ?? false,
							toolCallId: permissionObject.toolCallId,
						};

			writeLogs(
				LogType.cli,
				getProjectName(),
				session.sessionId,
				`[USER REPLY FOR PERMISSION]: ${JSON.stringify(message)}`,
			);
			socket?.send(JSON.stringify(message));
			setPendingPermissionMessages(prev => prev.slice(0, -1));
		}
	};
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
