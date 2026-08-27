import * as fs from 'node:fs/promises';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { spawn } from 'child_process';

const execPromis = promisify(exec);

export async function read(path: string) {
    try {
        const data = await fs.readFile('./test.txt', { encoding: 'utf8' });
        return data;
    } catch (err) {
        throw new Error(`An error occured while reading file: ${err}`);
    }
}

export async function write(path: string, content: string) { //create new file
    try {
        await fs.writeFile(path, content);
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

export async function edit() {
    
}

export async function create() {

}

export async function del() {

}