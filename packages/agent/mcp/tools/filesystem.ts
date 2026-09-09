import * as fsp from 'node:fs/promises';
import * as fs from 'fs';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { spawn } from 'child_process';
import * as readline from 'readline';

const execPromis = promisify(exec);

interface ReadArgs {
    path: string,
    offset?: number,
    limit?: number,
};
interface EditArgs {
    path: string,
    old_str: string,
    new_str: string
};

export async function read(args: ReadArgs) {
    try {
        if (!args.limit || !args.offset) {
            const data = await fsp.readFile((args.path), { encoding: 'utf8' });
            return data;
        }
        const fileStream = fs.createReadStream(args.path);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });
        let i = 0;
        let result = ``;
        for await (const line of rl) {
            i += 1;
            if (i >= args.offset && (i <= (i + args.limit - 1))) {
                result += line;
                if (i === (i + args.limit - 1)) break;
            }
        }
        return result;
    } catch (err) {
        throw new Error(`An error occured while reading file: ${err}`);
    }
}

export async function edit(args: EditArgs) {
    try {
        const data = await fsp.readFile((args.path), { encoding: 'utf8' });
        let count = 0 , pos = 0;
        while((pos=data.indexOf(args.old_str , pos)) !== -1){
            pos+=args.old_str.length;
            count++;
        }
        if(count>1){
            throw new Error(`More than 1 substring found`)
        }
        else if(count === 1){
            data.replace(args.old_str , args.old_str);
            await fsp.writeFile(args.path , data);
            return true;
        }
        throw new Error(`string not found`)
    }
    catch (err) {
        throw new Error(`An error occured while editing file: ${err}`);
    }
}

export async function write(path: string, content: string) { //create new file
    try {
        await fsp.writeFile(path, content);
    } catch (err) {
        throw new Error(`An error occured while writing file: ${err}`);
    }
}

interface GrepOutput {
    stdout: string | null,
    stderr: string | null,
    exitCode: number | null,
}

export function grep(path: string, pattern: string, flag?: string): Promise<GrepOutput> {
    return new Promise((resolve) => {
        const output: GrepOutput = {
            stdout: '',
            stderr: '',
            exitCode: null,
        };

        // 1. Cleanly build arguments without passing empty strings
        const args: string[] = [];
        if (flag) args.push(flag);
        args.push(pattern, path);

        const grepProcess = spawn('grep', args);

        // 2. Accumulate binary Data Buffers as text strings
        grepProcess.stdout.on('data', (data) => {
            output.stdout += data.toString();
        });

        grepProcess.stderr.on('data', (data) => {
            output.stderr += data.toString();
        });

        // 3. Resolve the promise ONLY when the process has closed
        grepProcess.on('close', (code) => {
            output.exitCode = code;
            resolve(output);
        });
    });
}

export async function list() {
    const { stdout, stderr } = await execPromis('ls');
    return { stdout, stderr }
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
    fsp.rm(path, options);
}