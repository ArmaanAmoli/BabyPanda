import React, {createContext, useState} from 'react';

export interface TemporaryToolCall {
	name: string;
	content: string;
}

interface ToolCallsContextValue {
	toolCalls: TemporaryToolCall[];
	setToolCalls: React.Dispatch<React.SetStateAction<TemporaryToolCall[]>>;
	clearToolCalls: () => void;
}

export const ToolCallsContext = createContext<ToolCallsContextValue | null>(
	null,
);

export function ToolCallsProvider({children}: {children: React.ReactNode}) {
	const [toolCalls, setToolCalls] = useState<TemporaryToolCall[]>([]);
	const clearToolCalls = () => {
		setToolCalls([]);
	};

	return (
		<ToolCallsContext.Provider
			value={{toolCalls, setToolCalls, clearToolCalls}}
		>
			{children}
		</ToolCallsContext.Provider>
	);
}
