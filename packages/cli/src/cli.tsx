#!/usr/bin/env node
import React from 'react';
import {render} from 'ink';
import App from './app';
import Bun from 'bun';
import {startSession} from './services/requests';
import honoServer from '@baby-panda/server';
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
import {FilteredStdin} from './utils/terminal/filterStdin';

const filteredStdin = new FilteredStdin(process.stdin);
const server = Bun.serve(honoServer);
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
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);
process.on('SIGHUP', cleanup);
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

const {waitUntilExit} = render(
	<>
		<TerminalProvider>
			<MouseProvider filteredStdin={filteredStdin}>
				<SessionProvider id={initialSessionId}>
					<MessageHistoryProvider>
						<PendingPermissionMessagesProvider>
							<ViewPortMessageProvider>
								<SocketProvider>
									<App />
								</SocketProvider>
							</ViewPortMessageProvider>
						</PendingPermissionMessagesProvider>
					</MessageHistoryProvider>
				</SessionProvider>
			</MouseProvider>
		</TerminalProvider>
	</>,
	{
		alternateScreen: true,
		incrementalRendering: true, // we dont want ink to erase the entire terminal and repaint it will cause filckering
		stdin: filteredStdin as unknown as NodeJS.ReadStream,
	},
);
await waitUntilExit();
console.log('stopping server');
server.stop();
console.log('Baby panda closed.');

process.exit(0);
