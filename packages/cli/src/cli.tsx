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
	disableBracketedPaste,
	disableKittyKeyboardProtocol,
	disableLineWrapping,
	disableMouseEvents,
	enableBracketedPaste,
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
import {ToolCallUiProvider} from './context/ToolCallUi';
import {ScrollProvider} from './context/Scroll';
import {ReasoningUiProvider} from './context/ReasoningUi';
import {pandaBannerRows} from './utils/pandaBanner';

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
enableBracketedPaste();
enableMouseEvents();
const cleanupTerminal = () => {
	disableMouseEvents();
	disableBracketedPaste();
	disableKittyKeyboardProtocol();
	disableLineWrapping();
	if (process.stdin.isTTY) {
		process.stdin.setRawMode?.(false);
	}
	deactivateAlternateScreenBuffer();
	filteredStdin.dispose();
};
let terminalCleanedUp = false;
const cleanup = () => {
	if (terminalCleanedUp) return;
	terminalCleanedUp = true;
	cleanupTerminal();
};
process.on('exit', cleanup);
let serverStopped = false;
const stopServer = () => {
	if (serverStopped) return;
	serverStopped = true;
	server.stop(true);
};
let appUnmount: (() => void) | undefined = undefined;
let shuttingDown = false;
/**
 * Prints the farewell banner to the primary screen. The alternate screen has
 * to be left first, or the rows are discarded with it when the process exits.
 */
const printExitBanner = (sessionId: string) => {
	const columns = process.stdout.columns ?? 80;
	process.stdout.write('\n');
	for (const row of pandaBannerRows(sessionId, columns)) {
		process.stdout.write(`${row}\n`);
	}
};
const shutdown = (exitCode: number, error?: unknown) => {
	if (shuttingDown) return;
	shuttingDown = true;
	if (error !== undefined) {
		console.error('BabyPanda stopped unexpectedly:', error);
	}
	cleanup();
	stopServer();
	appUnmount?.();
	// only a clean exit gets the farewell; a crash keeps its error visible
	if (exitCode === 0) {
		printExitBanner(initialSessionId ?? '');
	}
	process.exit(exitCode);
};
process.on('SIGTERM', () => shutdown(0));
process.on('SIGINT', () => shutdown(0));
process.on('SIGHUP', () => shutdown(0));
process.on('uncaughtException', error => shutdown(1, error));
process.on('unhandledRejection', reason => shutdown(1, reason));
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
					<ScrollProvider>
						<SessionProvider id={initialSessionId}>
							<MessageHistoryProvider>
								<PendingPermissionMessagesProvider>
									<ViewPortMessageProvider>
										<VisibleMessageProvider>
											<ToolCallsProvider>
												<SocketProvider>
													<ToolCallUiProvider>
														<ReasoningUiProvider>
															<App />
														</ReasoningUiProvider>
													</ToolCallUiProvider>
												</SocketProvider>
											</ToolCallsProvider>
										</VisibleMessageProvider>
									</ViewPortMessageProvider>
								</PendingPermissionMessagesProvider>
							</MessageHistoryProvider>
						</SessionProvider>
					</ScrollProvider>
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

appUnmount = unmount;
await waitUntilExit();
stopServer();
// Ink has unmounted, so the alternate screen can be left and the farewell
// banner written to the primary screen, where it survives the exit.
cleanup();
printExitBanner(initialSessionId ?? '');

process.exit(0);
