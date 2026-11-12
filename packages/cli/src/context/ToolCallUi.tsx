import React, {createContext, useCallback, useMemo, useState} from 'react';

/**
 * Expand/collapse state for ToolCallMessage groups and their per-bullet
 * DiffViewers. Kept at provider level (not inside the components) so the
 * ChatBox can compute item heights and the keyboard handler can toggle the
 * focused group. Keys are stable entry ids (batch id / call id).
 */
interface ToolCallUiContextValue {
	expandedGroups: Record<string, boolean>;
	expandedDiffs: Record<string, boolean>;
	expandedCommands: Record<string, boolean>;
	isGroupExpanded: (batchId: string) => boolean;
	toggleGroup: (batchId: string) => void;
	isDiffExpanded: (callId: string) => boolean;
	toggleDiff: (callId: string) => void;
	expandGroup: (batchId: string) => void;
	isCommandExpanded: (bulletKey: string) => boolean;
	toggleCommand: (bulletKey: string) => void;
}

export const ToolCallUiContext = createContext<ToolCallUiContextValue | null>(
	null,
);

export function ToolCallUiProvider({children}: {children: React.ReactNode}) {
	const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
		{},
	);
	const [expandedDiffs, setExpandedDiffs] = useState<Record<string, boolean>>(
		{},
	);
	const [expandedCommands, setExpandedCommands] = useState<
		Record<string, boolean>
	>({});

	const isGroupExpanded = useCallback(
		(batchId: string) => expandedGroups[batchId] === true,
		[expandedGroups],
	);
	const toggleGroup = useCallback((batchId: string) => {
		setExpandedGroups(previous => ({
			...previous,
			[batchId]: previous[batchId] !== true,
		}));
	}, []);
	const expandGroup = useCallback((batchId: string) => {
		setExpandedGroups(previous =>
			previous[batchId] === true ? previous : {...previous, [batchId]: true},
		);
	}, []);
	const isDiffExpanded = useCallback(
		(callId: string) => expandedDiffs[callId] === true,
		[expandedDiffs],
	);
	const toggleDiff = useCallback((callId: string) => {
		setExpandedDiffs(previous => ({
			...previous,
			[callId]: previous[callId] !== true,
		}));
	}, []);
	const isCommandExpanded = useCallback(
		(bulletKey: string) => expandedCommands[bulletKey] === true,
		[expandedCommands],
	);
	const toggleCommand = useCallback((bulletKey: string) => {
		setExpandedCommands(previous => ({
			...previous,
			[bulletKey]: previous[bulletKey] !== true,
		}));
	}, []);

	const value = useMemo(
		() => ({
			expandedGroups,
			expandedDiffs,
			expandedCommands,
			isGroupExpanded,
			toggleGroup,
			isDiffExpanded,
			toggleDiff,
			expandGroup,
			isCommandExpanded,
			toggleCommand,
		}),
		[
			expandedGroups,
			expandedDiffs,
			expandedCommands,
			isGroupExpanded,
			toggleGroup,
			isDiffExpanded,
			toggleDiff,
			expandGroup,
			isCommandExpanded,
			toggleCommand,
		],
	);

	return (
		<ToolCallUiContext.Provider value={value}>
			{children}
		</ToolCallUiContext.Provider>
	);
}
