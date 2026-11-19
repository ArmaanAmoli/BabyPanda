import {deleteSessionsCommand} from './deleteSessions';
import {installCommand, uninstallCommand} from './install';
import {listSessionsCommand} from './listSessions';
import {resolveSessionToOpen} from './openSession';
import {printUsage} from './usage';

/**
 * What the caller should do with the arguments it was given.
 *
 * - `none`: not a system command, start the terminal UI with a new session
 * - `session`: start the terminal UI on this existing session
 * - `exit`: a system command ran, stop with this status
 */
export type DispatchResult =
	| {kind: 'none'}
	| {kind: 'session'; sessionId: string}
	| {kind: 'exit'; code: number};

interface FlagSpec {
	/** Canonical name -> aliases. Switches take no value. */
	switches: Record<string, string[]>;
	/** Canonical name -> aliases. Options take the next argument or `=value`. */
	options: Record<string, string[]>;
}

type ParsedArguments =
	| {
			ok: true;
			positionals: string[];
			switches: Record<string, boolean>;
			options: Record<string, string>;
	  }
	| {ok: false; error: string};

/**
 * A deliberately small argument parser: every command here has at most a
 * handful of flags, and the whole point of the surface is that it can be read
 * (and tested) without pulling in a CLI framework.
 */
export function parseArguments(
	args: readonly string[],
	spec: FlagSpec,
): ParsedArguments {
	const switchAliases = new Map<string, string>();
	for (const [name, aliases] of Object.entries(spec.switches)) {
		for (const alias of aliases) {
			switchAliases.set(alias, name);
		}
	}
	const optionAliases = new Map<string, string>();
	for (const [name, aliases] of Object.entries(spec.options)) {
		for (const alias of aliases) {
			optionAliases.set(alias, name);
		}
	}

	const positionals: string[] = [];
	const switches: Record<string, boolean> = {};
	const options: Record<string, string> = {};

	for (let index = 0; index < args.length; index++) {
		const argument = args[index]!;
		if (argument === '--') {
			positionals.push(...args.slice(index + 1));
			break;
		}
		if (argument === '-' || !argument.startsWith('-')) {
			positionals.push(argument);
			continue;
		}

		const separator = argument.indexOf('=');
		const flag = separator === -1 ? argument : argument.slice(0, separator);
		const inlineValue =
			separator === -1 ? undefined : argument.slice(separator + 1);

		const switchName = switchAliases.get(flag);
		if (switchName !== undefined) {
			if (inlineValue !== undefined) {
				return {ok: false, error: `${flag} does not take a value`};
			}
			switches[switchName] = true;
			continue;
		}

		const optionName = optionAliases.get(flag);
		if (optionName !== undefined) {
			if (inlineValue !== undefined) {
				options[optionName] = inlineValue;
				continue;
			}
			const value = args[index + 1];
			if (value === undefined) {
				return {ok: false, error: `${flag} needs a value`};
			}
			options[optionName] = value;
			index++;
			continue;
		}

		return {ok: false, error: `unknown option ${flag}`};
	}

	return {ok: true, positionals, switches, options};
}

const LIST_SPEC: FlagSpec = {
	switches: {json: ['--json']},
	options: {},
};

const DELETE_SPEC: FlagSpec = {
	switches: {yes: ['--yes', '-y']},
	options: {},
};

const OPEN_SPEC: FlagSpec = {
	switches: {},
	options: {},
};

const INSTALL_SPEC: FlagSpec = {
	switches: {
		copy: ['--copy'],
		force: ['--force', '-f'],
		addToPath: ['--add-to-path'],
	},
	options: {directory: ['--dir', '-d']},
};

const UNINSTALL_SPEC: FlagSpec = {
	switches: {force: ['--force', '-f']},
	options: {directory: ['--dir', '-d']},
};

function usageError(message: string): DispatchResult {
	process.stderr.write(`babypanda: ${message}\n`);
	printUsage(process.stderr);
	return {kind: 'exit', code: 1};
}

/**
 * Routes the arguments the process was started with.
 *
 * This runs before the terminal UI touches stdin, stdout or the server: the
 * session commands are plain reads and writes against the database and must
 * not inherit the alternate screen buffer, raw mode, or a WebSocket.
 */
export async function dispatchSystemCommand(
	args: readonly string[],
): Promise<DispatchResult> {
	const [name, ...rest] = args;

	// A bare `babypanda` starts a new session; the terminal UI creates it.
	if (name === undefined) {
		return {kind: 'none'};
	}

	if (name === 'help' || name === '--help' || name === '-h') {
		printUsage();
		return {kind: 'exit', code: 0};
	}

	switch (name) {
		case 'list':
		case 'ls': {
			const parsed = parseArguments(rest, LIST_SPEC);
			if (!parsed.ok) {
				return usageError(parsed.error);
			}
			return {
				kind: 'exit',
				code: await listSessionsCommand({json: parsed.switches['json']}),
			};
		}

		case 'delete':
		case 'rm': {
			const parsed = parseArguments(rest, DELETE_SPEC);
			if (!parsed.ok) {
				return usageError(parsed.error);
			}
			return {
				kind: 'exit',
				code: await deleteSessionsCommand(parsed.positionals, {
					yes: parsed.switches['yes'],
				}),
			};
		}

		case 'open':
		case 'resume': {
			const parsed = parseArguments(rest, OPEN_SPEC);
			if (!parsed.ok) {
				return usageError(parsed.error);
			}
			const [reference, ...extra] = parsed.positionals;
			if (reference === undefined) {
				return usageError('open expects a session id');
			}
			if (extra.length > 0) {
				return usageError('open expects exactly one session id');
			}
			return openSession(reference);
		}

		case 'install': {
			const parsed = parseArguments(rest, INSTALL_SPEC);
			if (!parsed.ok) {
				return usageError(parsed.error);
			}
			return {
				kind: 'exit',
				code: await installCommand({
					directory: parsed.options['directory'],
					copy: parsed.switches['copy'],
					force: parsed.switches['force'],
					addToPath: parsed.switches['addToPath'],
				}),
			};
		}

		case 'uninstall': {
			const parsed = parseArguments(rest, UNINSTALL_SPEC);
			if (!parsed.ok) {
				return usageError(parsed.error);
			}
			return {
				kind: 'exit',
				code: await uninstallCommand({
					directory: parsed.options['directory'],
					force: parsed.switches['force'],
				}),
			};
		}

		default: {
			// Not a system command, so it is the historical `babypanda SESSION_ID`
			// form. Anything else is a mistake worth reporting rather than
			// silently opening a session that does not exist.
			if (name.startsWith('-')) {
				return usageError(`unknown option ${name}`);
			}
			if (rest.length > 0) {
				return usageError(`unexpected argument ${rest[0]}`);
			}
			return openSession(name);
		}
	}
}

async function openSession(reference: string): Promise<DispatchResult> {
	const resolution = await resolveSessionToOpen(reference);
	if ('error' in resolution) {
		process.stderr.write(`${resolution.error}\n`);
		return {kind: 'exit', code: 1};
	}
	return {kind: 'session', sessionId: resolution.sessionId};
}
