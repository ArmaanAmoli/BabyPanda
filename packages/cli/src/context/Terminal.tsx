import React from 'react';
import {useState, createContext, useEffect} from 'react';
import {useStdout} from 'ink';

interface TerminalContextValue {
	rows: number;
	columns: number;
}
export const TerminalContext = createContext<TerminalContextValue | null>(null);

export function TerminalProvider({children}: {children: React.ReactNode}) {
	const {stdout} = useStdout();
	const [{rows, columns}, setTerminal] = useState<{
		rows: number;
		columns: number;
	}>({rows: stdout.rows, columns: stdout.columns});

	useEffect(() => {
		const handleResize = () => {
			setTerminal({
				columns: stdout.columns,
				rows: stdout.rows,
			});
		};
		stdout.on('resize', handleResize);
		return () => {
			stdout.off('resize', handleResize);
		};
	}, [stdout]);

	return (
		<TerminalContext.Provider value={{rows, columns}}>
			{children}
		</TerminalContext.Provider>
	);
}
