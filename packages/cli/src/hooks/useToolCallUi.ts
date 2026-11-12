import {useContext} from 'react';
import {ToolCallUiContext} from '../context/ToolCallUi';

export function useToolCallUi() {
	const context = useContext(ToolCallUiContext);
	if (context == null) {
		throw new Error('useToolCallUi must be used within <ToolCallUiProvider>');
	}
	return context;
}
