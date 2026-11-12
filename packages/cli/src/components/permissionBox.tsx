import React from 'react';
import usePendingPermissionMessages from '../hooks/usePendingPermissionMessages';
import {Box, Text} from 'ink';
import useSocket from '../hooks/useSocket';
import SelectInput from 'ink-select-input';
import {
	LogType,
	PermissionsEnums,
	WsEventMessage,
	WsEventTypes,
} from '@baby-panda/types';
import {writeLogs, getProjectName} from '@baby-panda/utils';
import {useSession} from '../hooks/useSession';
import {getWrappedLineCount} from '../utils/promptLayout';

interface PermissionItem {
	label: string;
	value: boolean;
}

const items: PermissionItem[] = [
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

/**
 * Rows the permission box needs to show a command in full plus every
 * option: one row per wrapped content line + one row per select item.
 */
export function getPermissionBoxHeight(content: string, width: number): number {
	return getWrappedLineCount(content, Math.max(1, width)) + items.length;
}

export function PermissionBox() {
	const session = useSession();
	const {pendingPermissionMessages, setPendingPermissionMessages} =
		usePendingPermissionMessages();
	const socket = useSocket();
	const handleSelect = async (item: PermissionItem) => {
		await send(item);
	};
	const send = async (item: PermissionItem) => {
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

			await writeLogs(
				LogType.cli,
				getProjectName(),
				session.sessionId,
				`[USER REPLY FOR PERMISSION]: ${JSON.stringify(message)}`,
			);
			socket?.send(JSON.stringify(message));
			setPendingPermissionMessages(prev => prev.slice(0, -1));
		}
	};
	const content =
		pendingPermissionMessages[pendingPermissionMessages.length - 1]?.content ??
		'';
	return (
		<>
			{socket && pendingPermissionMessages.length !== 0 && (
				<Box
					flexDirection="column"
					justifyContent="flex-start"
					alignItems="center"
					height="100%"
				>
					{/* shrinkable and clipped so a long command can never push
					    the options out of the visible box */}
					<Box
						flexDirection="column"
						width="100%"
						flexShrink={1}
						minHeight={1}
						overflow="hidden"
					>
						<Text>{content}</Text>
					</Box>
					<Box flexShrink={0}>
						<SelectInput items={items} onSelect={handleSelect} />
					</Box>
				</Box>
			)}
		</>
	);
}
