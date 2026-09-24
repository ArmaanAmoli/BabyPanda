import * as fs from 'fs';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { spawn } from 'child_process';
import * as readline from 'readline';
import * as gl from 'glob';
import { file } from 'zod';


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
            const data = await fs.promises.readFile((args.path), { encoding: 'utf8' });
            return data;
        }
        const fileStream = fs.createReadStream(args.path);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });
        let i = 0;
        let result = ``;
        const end = args.offset + args.limit - 1;
        for await (const line of rl) {
            i += 1;
            if (i >= args.offset && (i <= end)) {
                result += line + '\n';
                if (i === (i + args.limit - 1)) break;
            }
        }
        return result;
    } catch (err) {
        throw new Error(`An error occured while reading file: ${err}`);
    }
}

function getLineNumber(content: string, index: number): number {
    const before = content.slice(0, index);
    const newLineCount = (before.match(/\n/g) || []).length;
    return newLineCount + 1;
}

export async function edit(args: EditArgs) {
    try {
        if(args.old_str.length === 0){return true;}
        const raw = await fs.promises.readFile((args.path), { encoding: 'utf8' });
        const usesCRLF = raw.includes('\r\n');
        const data = usesCRLF ? raw.replace(/\r\n/g, '\n') : raw;
        const oldStr = args.old_str.replace(/\r\n/g, '\n');
        const newStr = args.new_str.replace(/\r\n/g, '\n');
        let count = 0, pos = 0;
        const lines = []
        while ((pos = data.indexOf(oldStr, pos)) !== -1) {
            lines.push(getLineNumber(data, pos));
            pos += args.old_str.length;
            count++;
        }
        if (count > 1) {
            throw new Error(
                `old_str matched ${count} times in ${args.path} at lines ${lines}.
Include more surrounding context (e.g. the enclosing function 
name or a nearby comment) to uniquely identify the location you mean.`)
        }
        else if (count === 1) {
            let newData = data.replace(oldStr, newStr);
            newData = usesCRLF ? newData.replace(/\n/g , '\r\n'):newData;
            await fs.promises.writeFile(args.path, newData);
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
        await fs.promises.writeFile(path, content);
        return true;
    } catch (err) {
        throw new Error(`An error occured while writing file: ${err}`);
    }
}

export async function mkdir(path:string){
    try{
        await fs.promises.mkdir(path);
        return true;
    }catch(err){
        throw new Error(`An error occured while making directory: ${err}`)
    }
}

interface GrepOutput {
    stdout: string | null,
    stderr: string | null,
    exitCode: number | null,
}

export function grep(path: string, pattern: string, flag?: string): Promise<GrepOutput> {
    return new Promise((resolve, reject) => {
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
            console.log(output);
            resolve(output);
        });

        grepProcess.on('error', (error) => {
            reject(error);
        })
    });
}

export async function list(path: string) {
    try {
        const result: string[] = await fs.promises.readdir(path);
        return result;
    } catch (e) {
        throw new Error(`/packages/agent/mcp/tools/filesystem.ts:134:142 Error occured in list tool ${e}`);
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
        throw new Error(`/packages/agent/mcp/tools/filesystem.ts:173:179 Error occured in delete tool ${e}`);
    }
}

export async function glob(pattern: string, ignorePatterns?: string[]): Promise<string[]> {
    try {
        const files = await gl.glob(pattern, { ignore: ignorePatterns, windowsPathsNoEscape: true });
        return files;
    } catch (e) {
        throw e;
    }
}