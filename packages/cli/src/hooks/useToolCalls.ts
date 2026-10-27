import {useContext} from 'react';
import {ToolCallsContext} from '../context/ToolCalls';

export function useToolCalls() {
	const context = useContext(ToolCallsContext);
	if (context == null) {
		throw new Error('useToolCalls must be used within <ToolCallsProvider>');
	}
	return context;
}
