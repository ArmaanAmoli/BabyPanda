import {useContext} from 'react';
import {ActiveComponentsContext} from '../context/CompontActiveState';

export function useActiveComponentState() {
	const activeComponentStates = useContext(ActiveComponentsContext);
	if (activeComponentStates == null) {
		throw new Error(
			'useActivationComponentState was not used inside the ActiveComponetsContextProvider',
		);
	}
	return activeComponentStates;
}
