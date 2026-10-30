import {DOMElement, measureElement} from 'ink';
import React, {createContext, useState} from 'react';

/*
ScrollContext:
    * Reference of currently focused element
    * Its Dimensions {x , y , width , height}
*/

export interface Focus {
	ref: React.RefObject<DOMElement>;
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface FocusContextValue {
	focus: Focus | null;
	setFocus: (ref: React.RefObject<DOMElement>) => void;
}

export const FocusContext = createContext<FocusContextValue | null>(null);

export function FocusProvider({children}: {children: React.ReactNode}) {
	const [focus, setFocusState] = useState<Focus | null>(null);

	const setFocus = (ref: React.RefObject<DOMElement>) => {
		if (ref.current != null) {
			const {x, y, width, height} = measureElement(ref.current);
			setFocusState({ref, x, y, width, height});
		}
	};

	return (
		<FocusContext.Provider value={{focus, setFocus}}>
			{children}
		</FocusContext.Provider>
	);
}
