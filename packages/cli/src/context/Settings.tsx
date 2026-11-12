import React, {SetStateAction} from 'react';
import {useState, createContext} from 'react';
import type {ProviderInfo} from '../services/requests';
import {ReasoningEffort} from '@baby-panda/types';

export interface SettingsContextValue {
	sandbox: {
		sandbox: boolean;
		setSandBox: React.Dispatch<SetStateAction<boolean>>;
	};

	responding: {
		responding: boolean;
		setResponding: React.Dispatch<SetStateAction<boolean>>;
	};
	compaction: {
		compacting: boolean;
		setCompacting: React.Dispatch<SetStateAction<boolean>>;
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
		reasoningEffort: ReasoningEffort;
		reasoningEfforts: ReasoningEffort[];
		setModelState: (state: Partial<SettingsContextValue['model']>) => void;
	};
}

export const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({children}: {children: React.ReactNode}) {
	const [sandbox, setSandBox] = useState(false);
	const [responding, setResponding] = useState(false);
	const [compacting, setCompacting] = useState(false);
	const [providers, setProviders] = useState<ProviderInfo[]>([]);
	const [model, setModel] = useState({
		provider: 'Nvidia',
		model: 'minimaxai/minimax-m3.1-flash',
		contextWindow: 262_000,
		contextWindowUsed: 0,
		reasoningEffort: ReasoningEffort.none,
		reasoningEfforts: Object.values(ReasoningEffort),
	});
	const value: SettingsContextValue = {
		sandbox: {sandbox, setSandBox},
		responding: {responding, setResponding},
		compaction: {compacting, setCompacting},
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
