import {useContext} from 'react';
import {MouseContext} from '../context/MouseContext';
import {MouseHandler} from '../utils/terminal/mouse';

export function useMouseContext() {
	const mouseContext = useContext(MouseContext);
	if (!mouseContext) {
		throw new Error('Use useMouseContext under <MouseProvider>');
	}
	return mouseContext;
}

export function useMouse(handler: MouseHandler, {isActive = true} = {}) {
	const {subscribe, unsubscribe} = useMouseContext();
	if (!isActive) {
		return;
	}
	subscribe(handler);
	return () => {
		unsubscribe(handler);
	};
}
