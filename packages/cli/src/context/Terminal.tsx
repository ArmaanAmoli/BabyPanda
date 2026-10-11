import React from 'react';
import {useState, createContext} from 'react';
import {useStdout} from 'ink';

interface TerminalContextValue {
	rows: number;
	columns: number;
}
export const TerminalContext = createContext<TerminalContextValue | null>(null);

export function TerminalProvider({children}: {children: React.ReactNode}) {
	const {stdout} = useStdout();
	const {rows, columns} = stdout;

	return (
		<TerminalContext.Provider value={{rows, columns}}>
			{children}
		</TerminalContext.Provider>
	);
}
