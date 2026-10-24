import {useContext} from 'react';
import {SettingsContext} from '../context/Settings';

export function useSettings() {
	const settings = useContext(SettingsContext);
	if (settings == null) {
		throw new Error('useSettings hook not used within <SettingsProvider> ');
	}
	return settings;
}
