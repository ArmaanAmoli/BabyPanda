import {useContext} from 'react';
import {FocusContext} from '../context/Focus';

export function useFocus() {
	const focus = useContext(FocusContext);
	if (focus == null) {
		throw new Error('useFocus not used under FocusProvider');
	}
	return focus;
}
