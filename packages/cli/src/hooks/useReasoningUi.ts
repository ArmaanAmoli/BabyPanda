import {useContext} from 'react';
import {ReasoningUiContext} from '../context/ReasoningUi';

export function useReasoningUi() {
	const context = useContext(ReasoningUiContext);
	if (context == null) {
		throw new Error('useReasoningUi must be used within <ReasoningUiProvider>');
	}
	return context;
}
