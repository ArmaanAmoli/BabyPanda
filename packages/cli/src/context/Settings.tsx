import React, {SetStateAction} from 'react';
import {useState, createContext} from 'react';

export interface SettingsContextValue {
	sandbox: {
		sandbox: boolean;
		setSandBox: React.Dispatch<SetStateAction<boolean>>;
	};

	responding: {
		responding: boolean;
		setResponding: React.Dispatch<SetStateAction<boolean>>;
	};
}

export const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({children}: {children: React.ReactNode}) {
	const [sandbox, setSandBox] = useState(false);
	const [responding, setResponding] = useState(false);
	const value: SettingsContextValue = {
		sandbox: {sandbox, setSandBox},
		responding: {responding, setResponding},
	};

	return (
		<SettingsContext.Provider value={value}>
			{children}
		</SettingsContext.Provider>
	);
}
