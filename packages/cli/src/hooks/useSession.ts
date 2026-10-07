import {useContext} from 'react';
import {SessionContext} from '../context/sessionDetails';
import {writeLogs} from '@baby-panda/utils';
import {getProjectName} from '@baby-panda/utils';
import {LogType} from '@baby-panda/types';

export function useSession() {
	const sessionContext = useContext(SessionContext);
	if (!sessionContext) {
		writeLogs(
			LogType.cli,
			getProjectName(),
			'global',
			'[session hook]: session context not provided',
		);
		throw new Error(`useSession must be used inside SessionProvider`);
	}
	return sessionContext;
}
