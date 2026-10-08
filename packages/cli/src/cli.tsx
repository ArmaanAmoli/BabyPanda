#!/usr/bin/env node
import React from 'react';
import {render} from 'ink';
import App from './app';
import Bun from 'bun';
import {startSession} from './services/requests';
import honoServer from '@baby-panda/server';
import {SessionProvider} from './context/sessionDetails';
import {PendingPermissionMessagesProvider} from './context/pendingPermissionMessages';
import {SocketProvider} from './context/webSocket';
import {ActiveComponetsContextProvider} from './context/compontActiveState';
import {MessageHistoryProvider} from './context/messageHistory';

const server = Bun.serve(honoServer);
if (typeof Bun !== 'undefined') {
	process.stdin.resume();
	process.stdin.setRawMode?.(true);
}

// since we are using incrimental rendering we need to disable terminal history which we can do by switching the terminal to temporary fullscreen view

// 1. Immediately switch to the Alternate Screen Buffer
process.stdout.write('\x1b[?1049h');
// process.stdout.write('\x1B[?1006h'); // SGR mouse encoding
// process.stdout.write('\x1B[?1000h'); // Button press/release only
// 2. Automatically clean up and return to normal screen when the process exits
process.on('exit', () => {
	process.stdout.write('\x1b[?1049l');
	// process.stdout.write('\x1B[?1000l');
	// process.stdout.write('\x1B[?1006l');
});

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
		<SessionProvider id={initialSessionId}>
			<MessageHistoryProvider>
				<PendingPermissionMessagesProvider>
					<SocketProvider>
						<ActiveComponetsContextProvider>
							<App />
						</ActiveComponetsContextProvider>
					</SocketProvider>
				</PendingPermissionMessagesProvider>
			</MessageHistoryProvider>
		</SessionProvider>
	</>,
	{
		alternateScreen: true,
		incrementalRendering: true, // we dont want ink to erase the entire terminal and repaint it will cause filckering
	},
);
await waitUntilExit();
console.log('stopping server');
server.stop();
console.log('Baby panda closed.');

process.exit(0);
