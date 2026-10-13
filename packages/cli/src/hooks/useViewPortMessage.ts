import React, {useContext} from 'react';
import {ViewPortMessageContext} from '../context/ViewPortMessage';

export function useViewPortMessage() {
	const viewPortContext = useContext(ViewPortMessageContext);
	if (viewPortContext == null) {
		throw new Error(
			'useViewPortMessage not used under <ViewPortMessageProvider>',
		);
	}
	return viewPortContext;
}
