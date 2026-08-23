#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import App from './app.js';


// since we are using incrimental rendering we need to disable terminal history which we can do by switching the terminal to temporary fullscreen view

// 1. Immediately switch to the Alternate Screen Buffer
process.stdout.write('\x1b[?1049h');

// 2. Automatically clean up and return to normal screen when the process exits
process.on('exit', () => {
	process.stdout.write('\x1b[?1049l');
});
// setTimeout(async () => {
	const { waitUntilExit } = render(<App />, {
		incrementalRendering: true // we dont want ink to erase the entire terminal and repaint it will cause filckering
	});
	await waitUntilExit();
	console.log('Baby panda closed.')
// }, 1)

