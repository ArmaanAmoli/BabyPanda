#!/usr/bin/env node
import React from 'react';
import {render} from 'ink';
import App from './app';
import Bun from 'bun';
import {startSession} from './services/requests';
import honoServer, {getServerPort, setServerPort} from '@baby-panda/server';
import {SessionProvider} from './context/SessionDetails';
import {PendingPermissionMessagesProvider} from './context/PendingPermissionMessages';
import {SocketProvider} from './context/WebSocket';
import {MessageHistoryProvider} from './context/MessageHistory';
import {
	activateAlternateScreenBuffer,
	deactivateAlternateScreenBuffer,
	disableKittyKeyboardProtocol,
	disableLineWrapping,
	disableMouseEvents,
	enableKittyKeyboardProtocol,
	enableLineWrapping,
	enableMouseEvents,
} from './utils/terminal/stdio';
import {MouseProvider} from './context/MouseContext';
import {TerminalProvider} from './context/Terminal';
import {ViewPortMessageProvider} from './context/ViewPortMessage';
import {VisibleMessageProvider} from './context/VisibleMessages';
import {SettingsProvider} from './context/Settings';
import {FilteredStdin} from './utils/terminal/filterStdin';
import {ToolCallsProvider} from './context/ToolCalls';

const filteredStdin = new FilteredStdin(process.stdin);

function isAddressInUseError(error: unknown) {
	return (
		typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		error.code === 'EADDRINUSE'
	);
}

function startServer() {
	let port = getServerPort();
	const portWasConfigured = process.env['BABY_PANDA_PORT'] !== undefined;

	while (port <= 65535) {
		try {
			const server = Bun.serve({...honoServer, port});
			if (server.port === undefined) {
				server.stop();
				throw new Error('BabyPanda server did not report a bound port');
			}
			setServerPort(server.port);
			return server;
		} catch (error) {
			if (portWasConfigured || !isAddressInUseError(error)) {
				throw error;
			}
			port++;
		}
	}

	throw new Error('No available port found for BabyPanda');
}

const server = startServer();
if (typeof Bun !== 'undefined') {
	process.stdin.resume();
	process.stdin.setRawMode?.(true);
}

/*
	since we are using incrimental rendering we need to disable terminal history
	which we can do by switching the terminal to temporary fullscreen view
	1. Immediately switch to the Alternate Screen Buffer
*/
activateAlternateScreenBuffer();
enableKittyKeyboardProtocol();
enableLineWrapping();
enableMouseEvents();
const cleanup = () => {
	disableMouseEvents();
	disableKittyKeyboardProtocol();
	disableLineWrapping();
	if (process.stdin.isTTY) {
		process.stdin.setRawMode?.(false);
	}
	deactivateAlternateScreenBuffer();
};
process.on('exit', cleanup);
const getInitialSessionId = () => {
	if (typeof process !== 'undefined' && process.argv && process.argv[2]) {
		return process.argv[2];
	}
	return null;
};
let initialSessionId = getInitialSessionId();
if (initialSessionId === null) {
	initialSessionId = await startSession();
}

const {waitUntilExit, unmount} = render(
	<>
		<SettingsProvider>
			<TerminalProvider>
				<MouseProvider filteredStdin={filteredStdin}>
					<SessionProvider id={initialSessionId}>
						<MessageHistoryProvider>
							<PendingPermissionMessagesProvider>
								<ViewPortMessageProvider>
									<VisibleMessageProvider start={1}>
										<ToolCallsProvider>
											<SocketProvider>
												<App />
											</SocketProvider>
										</ToolCallsProvider>
									</VisibleMessageProvider>
								</ViewPortMessageProvider>
							</PendingPermissionMessagesProvider>
						</MessageHistoryProvider>
					</SessionProvider>
				</MouseProvider>
			</TerminalProvider>
		</SettingsProvider>
	</>,
	{
		alternateScreen: true,
		incrementalRendering: true, // we dont want ink to erase the entire terminal and repaint it will cause filckering
		stdin: filteredStdin as unknown as NodeJS.ReadStream,
	},
);

let shuttingDown = false;
const shutdown = (exitCode: number) => {
	if (shuttingDown) return;
	shuttingDown = true;
	cleanup();
	server.stop();
	unmount();
	process.exit(exitCode);
};
process.on('SIGTERM', () => shutdown(0));
process.on('SIGINT', () => shutdown(0));
process.on('SIGHUP', () => shutdown(0));
await waitUntilExit();
console.log('stopping server');
server.stop();
console.log('Baby panda closed.', initialSessionId);

process.exit(0);
