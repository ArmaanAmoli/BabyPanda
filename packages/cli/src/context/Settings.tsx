import React, {SetStateAction} from 'react';
import {useState, createContext} from 'react';
import type {ProviderInfo} from '../services/requests';

export interface SettingsContextValue {
	sandbox: {
		sandbox: boolean;
		setSandBox: React.Dispatch<SetStateAction<boolean>>;
	};

	responding: {
		responding: boolean;
		setResponding: React.Dispatch<SetStateAction<boolean>>;
	};
	providers: {
		providers: ProviderInfo[];
		setProviders: React.Dispatch<SetStateAction<ProviderInfo[]>>;
	};
	model: {
		provider: string;
		model: string;
		contextWindow: number;
		contextWindowUsed: number;
		setModelState: (state: Partial<SettingsContextValue['model']>) => void;
	};
}

export const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({children}: {children: React.ReactNode}) {
	const [sandbox, setSandBox] = useState(false);
	const [responding, setResponding] = useState(false);
	const [providers, setProviders] = useState<ProviderInfo[]>([]);
	const [model, setModel] = useState({
		provider: 'Nvidia',
		model: 'minimaxai/minimax-m3.1-flash',
		contextWindow: 262_000,
		contextWindowUsed: 0,
	});
	const value: SettingsContextValue = {
		sandbox: {sandbox, setSandBox},
		responding: {responding, setResponding},
		providers: {providers, setProviders},
		model: {
			...model,
			setModelState: state => setModel(previous => ({...previous, ...state})),
		},
	};

	return (
		<SettingsContext.Provider value={value}>
			{children}
		</SettingsContext.Provider>
	);
}
