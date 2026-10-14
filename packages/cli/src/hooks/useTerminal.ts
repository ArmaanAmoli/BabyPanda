import {TerminalContext} from '../context/Terminal';
import {useContext} from 'react';

export function useTerminal() {
	const terminal = useContext(TerminalContext);
	if (terminal == null) {
		throw new Error('useTerminal was not used under <TerminalProvider>');
	}
	return terminal;
}
