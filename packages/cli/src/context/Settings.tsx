import {ProvidersEnum} from '@baby-panda/types';
import {providerIsSet, getActiveProvider} from '@baby-panda/utils';
import React, {SetStateAction, useEffect} from 'react';
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

	provider: {
		provider: ProvidersEnum | null;
		setProvider: React.Dispatch<SetStateAction<ProvidersEnum | null>>;
	};
}

export const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({children}: {children: React.ReactNode}) {
	const [sandbox, setSandBox] = useState(false);
	const [responding, setResponding] = useState(false);
	const [provider, setProvider] = useState<ProvidersEnum | null>(null);

	useEffect(() => {
		const checkProvider = async () => {
			if (await providerIsSet()) {
				const provider = await getActiveProvider();
				if (provider != undefined) {
					setProvider(provider.name);
				}
			}
		};
		checkProvider();
	}, []);

	const value: SettingsContextValue = {
		sandbox: {sandbox, setSandBox},
		responding: {responding, setResponding},
		provider: {provider, setProvider},
	};

	return (
		<SettingsContext.Provider value={value}>
			{children}
		</SettingsContext.Provider>
	);
}
