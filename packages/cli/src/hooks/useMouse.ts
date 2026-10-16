import {useContext, useEffect, useRef} from 'react';
import {MouseContext} from '../context/MouseContext';
import {MouseHandler} from '../utils/terminal/mouse';

export function useMouseContext() {
	const mouseContext = useContext(MouseContext);
	if (!mouseContext) {
		throw new Error('Use useMouseContext under <MouseProvider>');
	}
	return mouseContext;
}

export function useMouse(handler: MouseHandler) {
	const {subscribe, unsubscribe} = useMouseContext();
	const handlerRef = useRef(handler);

	// Keep the latest handler without making it a subscription dependency.
	useEffect(() => {
		handlerRef.current = handler;
	}, [handler]);

	useEffect(() => {
		const stableHandler: MouseHandler = event => handlerRef.current(event);
		subscribe(stableHandler);

		return () => {
			unsubscribe(stableHandler);
		};
	}, [subscribe, unsubscribe]);
}
