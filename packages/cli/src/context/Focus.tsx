import {DOMElement, measureElement} from 'ink';
import React, {createContext, useState, useRef} from 'react';
import {DOMRef} from '../types';

export interface FocusContextValue {
	focus: DOMRef | null;
	// currently focused element details
	addFocusableElement: (ref: React.RefObject<DOMElement>) => void;
	// adds a DOM element as a candidate for being focused
	setFocus: (x: number, y: number) => void;
	// automatically finds the candidate and assign focus to it
}

export const FocusContext = createContext<FocusContextValue | null>(null);

export function FocusProvider({children}: {children: React.ReactNode}) {
	const [focus, setFocusState] = useState<DOMRef | null>(null);
	const focusables = useRef<DOMRef[]>([]);

	const getFocusedElementRef = (_x: number, _y: number): DOMRef | null => {
		let result = null;
		focusables.current.forEach(r => {
			if (r.current != null) {
				const {x, y, height, width} = measureElement(r.current);
				if (_x >= x && _x <= x + width && _y >= y && _y <= y + height) {
					result = r;
					return result;
				}
			}
		});
		return result;
	};

	const setFocus = (x: number, y: number) => {
		const ref: DOMRef | null = getFocusedElementRef(x, y);
		if (ref == null) return;
		if (ref.current != null) {
			setFocusState(ref);
		}
	};

	const addFocusableElement = (ref: React.RefObject<DOMElement>) => {
		focusables.current.push(ref);
	};

	return (
		<FocusContext.Provider value={{focus, addFocusableElement, setFocus}}>
			{children}
		</FocusContext.Provider>
	);
}
