import React, {createContext, useCallback, useMemo, useState} from 'react';

/**
 * Expand/collapse state for reasoning blocks. Kept at provider level (like
 * ToolCallUi) so the ChatBox can compute item heights and the keyboard handler
 * can toggle the focused block. Keys are the group's first message index.
 *
 * A block is expanded unless it has been explicitly collapsed, so a fresh
 * session always shows reasoning and a reload never hides it.
 */
interface ReasoningUiContextValue {
	expandedReasoning: Record<string, boolean>;
	isReasoningExpanded: (key: string) => boolean;
	toggleReasoning: (key: string) => void;
}

export const ReasoningUiContext = createContext<ReasoningUiContextValue | null>(
	null,
);

export function ReasoningUiProvider({children}: {children: React.ReactNode}) {
	const [expandedReasoning, setExpandedReasoning] = useState<
		Record<string, boolean>
	>({});

	const isReasoningExpanded = useCallback(
		(key: string) => expandedReasoning[key] !== false,
		[expandedReasoning],
	);
	const toggleReasoning = useCallback((key: string) => {
		setExpandedReasoning(previous => ({
			...previous,
			[key]: previous[key] === false,
		}));
	}, []);

	const value = useMemo(
		() => ({expandedReasoning, isReasoningExpanded, toggleReasoning}),
		[expandedReasoning, isReasoningExpanded, toggleReasoning],
	);

	return (
		<ReasoningUiContext.Provider value={value}>
			{children}
		</ReasoningUiContext.Provider>
	);
}
