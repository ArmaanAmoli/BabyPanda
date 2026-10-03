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
	const activationStates = useRef<Map<ComponentName, ActivationState>>(
		new Map<ComponentName, ActivationState>(),
	);

	const setChatBox = (state: boolean) => {
		setChatBoxIsActive(state);
		setPromptBoxIsActive(!state);
	};
	const setPromptBox = (state: boolean) => {
		setChatBoxIsActive(!state);
		setPromptBoxIsActive(state);
	};

	useEffect(() => {
		activationStates.current.set(ComponentName.chatBox, {
			isActive: isChatBoxActive,
			setIsActive: setChatBox,
		});
		activationStates.current.set(ComponentName.promptBox, {
			isActive: isPromptBoxActive,
			setIsActive: setPromptBox,
		});
	}, [isChatBoxActive, isPromptBoxActive]);
	return (
		<ActiveComponentsContext.Provider value={activationStates.current}>
			{children}
		</ActiveComponentsContext.Provider>
	);
}
