import {ReasoningEffort} from '@baby-panda/types';

export interface Settings {
	sandbox?: boolean;
	reasoningEffort?: ReasoningEffort;
}

export function executeCommand(command: string): Settings {
	const parts = command.split(' ');
	const cmd = parts.at(0)?.substring(1);
	const args = parts.slice(1);

	switch (cmd) {
		case 'efforts': {
			if (
				args.length !== 1 ||
				!Object.values(ReasoningEffort).includes(args[0] as ReasoningEffort)
			) {
				throw new Error('effort must be one of: none, low, medium, high');
			}
			return {reasoningEffort: args[0] as ReasoningEffort};
		}
		case 'sandbox': {
			if (args.length != 1) {
				break;
			}
			const arg = args.at(0) ? args.at(0) : 'disable';
			if (arg !== 'enable' && arg !== 'disable') {
				throw new Error(
					"Invalid argument, sandbox support either 'enable' or 'diable' as argument",
				);
			}
			return {sandbox: arg === 'enable' ? true : false};
		}
		default: {
			throw new Error(`command ${cmd} do not exit`);
		}
	}

	return {};
}
