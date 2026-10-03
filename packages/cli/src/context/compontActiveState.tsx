import React, {SetStateAction, useEffect} from 'react';
import {createContext, useRef, useState} from 'react';
import {ComponentName} from '../types';

interface ActivationState {
	isActive: boolean;
	setIsActive:
		React.Dispatch<SetStateAction<boolean>> | ((state: boolean) => void);
}

export const ActiveComponentsContext = createContext<Map<
	ComponentName,
	ActivationState
> | null>(null);

export function ActiveComponetsContextProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const [isChatBoxActive, setChatBoxIsActive] = useState(true);
	const [isPromptBoxActive, setPromptBoxIsActive] = useState(false);
	const [activationStates, setActivationStates] = useState<
		Map<ComponentName, ActivationState>
	>(new Map<ComponentName, ActivationState>());

	const setChatBox = (state: boolean) => {
		setChatBoxIsActive(state);
		setPromptBoxIsActive(!state);
	};
	const setPromptBox = (state: boolean) => {
		setChatBoxIsActive(!state);
		setPromptBoxIsActive(state);
	};

	useEffect(() => {
		setActivationStates(prev => {
			const next = new Map(prev);

			next.set(ComponentName.chatBox, {
				isActive: isChatBoxActive,
				setIsActive: setChatBox,
			});

			next.set(ComponentName.promptBox, {
				isActive: isPromptBoxActive,
				setIsActive: setPromptBox,
			});

			return next;
		});
	}, [isChatBoxActive, isPromptBoxActive]);
	return (
		<ActiveComponentsContext.Provider value={activationStates}>
			{children}
		</ActiveComponentsContext.Provider>
	);
}
