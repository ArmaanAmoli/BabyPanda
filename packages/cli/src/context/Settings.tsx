import React, {SetStateAction} from 'react';
import {useState, createContext} from 'react';

interface SettingsContextValue {
	sandbox: {
		sandbox: boolean;
		setSandBox: React.Dispatch<SetStateAction<boolean>>;
	};
}

export const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({children}: {children: React.ReactNode}) {
	const [sandbox, setSandBox] = useState(false);
	return (
		<SettingsContext.Provider value={{sandbox: {sandbox, setSandBox}}}>
			{children}
		</SettingsContext.Provider>
	);
}
