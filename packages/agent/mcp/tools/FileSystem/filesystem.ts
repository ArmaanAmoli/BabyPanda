import * as fs from 'fs';
import { spawn } from 'child_process';
import * as readline from 'readline';
import * as gl from 'glob';
import path from 'path';
import { GREP_FLAGS } from '@baby-panda/types';

interface ReadArgs {
  path: string;
  offset?: number;
  limit?: number;
}
interface EditArgs {
  path: string;
  old_str: string;
  new_str: string;
}

export async function read(args: ReadArgs) {
  try {
    if (!args.limit || !args.offset) {
      const data = await fs.promises.readFile(args.path, { encoding: 'utf8' });
      return data;
    }
    const fileStream = fs.createReadStream(args.path);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });
    let i = 0;
    let result = ``;
    const end = args.offset + args.limit - 1;
    for await (const line of rl) {
      i += 1;
      if (i >= args.offset && i <= end) {
        result += line + '\n';
        if (i === i + args.limit - 1) break;
      }
    }
    return result;
  } catch (err) {
    throw new Error(`An error occured while reading file: `, { cause: err });
  }
}

function getLineNumber(content: string, index: number): number {
  const before = content.slice(0, index);
  const newLineCount = (before.match(/\n/g) || []).length;
  return newLineCount + 1;
}

export async function edit(args: EditArgs) {
  try {
    if (args.old_str.length === 0) {
      return true;
    }
    const raw = await fs.promises.readFile(args.path, { encoding: 'utf8' });
    const usesCRLF = raw.includes('\r\n');
    const data = usesCRLF ? raw.replace(/\r\n/g, '\n') : raw;
    const oldStr = args.old_str.replace(/\r\n/g, '\n');
    const newStr = args.new_str.replace(/\r\n/g, '\n');
    let count = 0,
      pos = 0;
    const lines = [];
    while ((pos = data.indexOf(oldStr, pos)) !== -1) {
      lines.push(getLineNumber(data, pos));
      pos += args.old_str.length;
      count++;
    }
    if (count > 1) {
      throw new Error(
        `old_str matched ${count} times in ${args.path} at lines ${lines}.
Include more surrounding context (e.g. the enclosing function 
name or a nearby comment) to uniquely identify the location you mean.`,
      );
    } else if (count === 1) {
      let newData = data.replace(oldStr, newStr);
      newData = usesCRLF ? newData.replace(/\n/g, '\r\n') : newData;
      await fs.promises.writeFile(args.path, newData);
      return true;
    }
    throw new Error(`string not found`);
  } catch (err) {
    throw new Error(`An error occured while editing file: ${err}`);
  }
}

export async function write(path: string, content: string) {
  //create new file
  try {
    await fs.promises.writeFile(path, content);
    return true;
  } catch (err) {
    throw new Error(`An error occured while writing file: ${err}`);
  }
}

export async function mkdir(path: string) {
  try {
    await fs.promises.mkdir(path);
    return true;
  } catch (err) {
    throw new Error(`An error occured while making directory: ${err}`);
  }
}

interface GrepOutput {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  /** Matched lines in `stdout`; also what the CLI reports as the result count. */
  matches: number;
  /** True when the search stopped early because of the caps below. */
  truncated: boolean;
}

/** Directories a recursive search skips, unless the search target is inside one. */
const EXCLUDED_DIRS = ['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.cache'];

/** Caps so a single search can never flood the model's context window. */
const MAX_MATCHES = 200;
const MAX_OUTPUT_BYTES = 64 * 1024;
const GREP_TIMEOUT_MS = 60_000;

/**
 * Accepts `i` or `-i` and rejects anything outside GREP_FLAGS, so a model can
 * never smuggle an arbitrary option into the spawned process.
 */
function normalizeGrepFlag(flag?: string): string[] {
  if (flag === undefined || flag.length === 0) return [];
  const name = flag.replace(/^-+/, '');
  if (!(GREP_FLAGS as readonly string[]).includes(name)) {
    throw new Error(`unsupported grep flag "${flag}". supported flags: ${GREP_FLAGS.join(', ')}`);
  }
  return [`-${name}`];
}

/** `--exclude-dir` args for every excluded directory the target is not inside. */
function excludedDirArgs(searchPath: string): string[] {
  const segments = path.resolve(searchPath).split(path.sep);
  return EXCLUDED_DIRS.filter((dir) => !segments.includes(dir)).map(
    (dir) => `--exclude-dir=${dir}`,
  );
}

function countMatches(stdout: string): number {
  return stdout.split('\n').filter((line) => line.length > 0).length;
}

/** Keeps only the whole lines that fit inside the caps. */
function truncateToCaps(stdout: string): string {
  const body = stdout.endsWith('\n') ? stdout.slice(0, -1) : stdout;
  const kept: string[] = [];
  let bytes = 0;
  for (const line of body.split('\n')) {
    const cost = line.length + 1;
    if (kept.length >= MAX_MATCHES || bytes + cost > MAX_OUTPUT_BYTES) break;
    kept.push(line);
    bytes += cost;
  }
  return kept.length > 0 ? `${kept.join('\n')}\n` : '';
}

export function grep(searchPath: string, pattern: string, flag?: string): Promise<GrepOutput> {
  return new Promise((resolve, reject) => {
    const output: GrepOutput = {
      stdout: '',
      stderr: '',
      exitCode: null,
      matches: 0,
      truncated: false,
    };

    // `-e` and `--` keep a pattern or path that starts with `-` from being read
    // as an option. `-r -n -H -I` make directory searches work, always name the
    // file (even for a single-file target), and skip binary noise.
    const args = [
      '-r',
      '-n',
      '-H',
      '-I',
      ...normalizeGrepFlag(flag),
      ...excludedDirArgs(searchPath),
      '-e',
      pattern,
      '--',
      searchPath,
    ];

    let settled = false;
    let bytes = 0;
    let lines = 0;

    const grepProcess = spawn('grep', args);

    const stopEarly = (reason: string) => {
      output.truncated = true;
      output.stderr += `${reason}\n`;
      grepProcess.kill('SIGTERM');
    };

    const timer = setTimeout(
      () => stopEarly(`grep stopped: exceeded the ${GREP_TIMEOUT_MS}ms timeout`),
      GREP_TIMEOUT_MS,
    );

    grepProcess.stdout.on('data', (data) => {
      // Once a cap is hit the rest of the stream is dropped, so a huge match
      // set can never be buffered in full before it is trimmed.
      if (output.truncated) return;
      const chunk = data.toString();
      output.stdout += chunk;
      bytes += chunk.length;
      lines += (chunk.match(/\n/g) ?? []).length;
      if (bytes >= MAX_OUTPUT_BYTES || lines >= MAX_MATCHES) {
        output.stdout = truncateToCaps(output.stdout);
        stopEarly(
          `grep stopped: output exceeded ${MAX_MATCHES} matches or ${MAX_OUTPUT_BYTES} bytes`,
        );
      }
    });

    grepProcess.stderr.on('data', (data) => {
      output.stderr += data.toString();
    });

    grepProcess.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`failed to run grep: ${error.message}`));
    });

    grepProcess.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      output.exitCode = code;
      output.matches = countMatches(output.stdout);
      resolve(output);
    });
  });
}

export async function list(path: string) {
  try {
    const result: string[] = await fs.promises.readdir(path);
    return result;
  } catch (e) {
    throw new Error(
      `/packages/agent/mcp/tools/filesystem.ts:134:142 Error occured in list tool ${e}`,
    );
  }
}

interface RmOptions {
  /**
   * When `true`, exceptions will be ignored if `path` does not exist.
   * @default false
   */
  force?: boolean | undefined;
  /**
   * If an `EBUSY`, `EMFILE`, `ENFILE`, `ENOTEMPTY`, or
   * `EPERM` error is encountered, Node.js will retry the operation with a linear
   * backoff wait of `retryDelay` ms longer on each try. This option represents the
   * number of retries. This option is ignored if the `recursive` option is not
   * `true`.
   * @default 0
   */
  maxRetries?: number | undefined;
  /**
   * If `true`, perform a recursive directory removal. In
   * recursive mode, operations are retried on failure.
   * @default false
   */
  recursive?: boolean | undefined;
  /**
   * The amount of time in milliseconds to wait between retries.
   * This option is ignored if the `recursive` option is not `true`.
   * @default 100
   */
  retryDelay?: number | undefined;
}

export async function del(path: string, options?: RmOptions) {
  try {
    await fs.promises.rm(path, options);
    return true;
  } catch (e) {
    throw new Error(
      `/packages/agent/mcp/tools/filesystem.ts:173:179 Error occured in delete tool ${e}`,
    );
  }
}

export async function glob(pattern: string, ignorePatterns?: string[]): Promise<string[]> {
  const files = await gl.glob(pattern, {
    ignore: ignorePatterns,
    windowsPathsNoEscape: true,
  });
  return files;
}
