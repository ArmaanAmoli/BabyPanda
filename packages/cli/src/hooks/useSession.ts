import {useContext} from 'react';
import {SessionContext} from '../context/SessionDetails';
import {logError, getProjectName} from '@baby-panda/utils';
import {LogType} from '@baby-panda/types';

export function useSession() {
	const sessionContext = useContext(SessionContext);
	if (!sessionContext) {
		void (async () => {
			await logError(
				LogType.cli,
				getProjectName(),
				'global',
				'useSession hook used outside SessionProvider',
			);
		})();
		throw new Error(`useSession must be used inside SessionProvider`);
	}
	return sessionContext;
}
