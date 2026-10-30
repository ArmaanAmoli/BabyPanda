import React from 'react';
import {useState, createContext, useRef} from 'react';
import {ScrollableEntry} from '../types';
import {useMouse} from '../hooks/useMouse';

export interface ScrollContextValue {
	scrollables: Map<string, ScrollableEntry>;
}
export const ScrollContext = createContext<ScrollContextValue | null>(null);

export function ScrollProvider({children}: {children: React.ReactNode}) {
	const scrollablesRef = useRef(new Map<string, ScrollableEntry>());
	/*
    Attach Mouse hook but it requires a mouse handler
        Task:
            create a mouse handler function which have access to focus
            with the focus we can find out candidates which will be scrolled
            then each candidate scrollBy will be triggered
        
            create a focus context which will store the focused element ref
    */

	return (
		<ScrollContext.Provider value={{scrollables: scrollablesRef.current}}>
			{children}
		</ScrollContext.Provider>
	);
}
