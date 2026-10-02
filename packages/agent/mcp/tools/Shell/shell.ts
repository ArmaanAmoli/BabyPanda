import os from 'os';
import { spawn } from 'node:child_process';

interface ShellResult {
  stdout: string;
  stderr: string;
  error: string;
  code: number | null;
  signal: NodeJS.Signals | null;
}

export async function shell(
  command: string,
  timeout: number
): Promise<ShellResult> {
  let stdout = '';
  let stderr = '';
  let error = '';
  const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
  const childProcess = spawn(command, [], {
    timeout: timeout,
    cwd: process.cwd(),
    shell,
  });
  childProcess.stdout.setEncoding('utf8');
  childProcess.stderr.setEncoding('utf8');
  return await new Promise((resolve) => {
    childProcess.stdout.on('data', (data) => {
      stdout += data;
    });

    childProcess.stderr.on('data', (data) => {
      stderr += data;
    });

    childProcess.on('error', (err: Error) => {
      error = err.message;
    });

    childProcess.on('close', (code, signal) => {
      resolve({ stdout, stderr, error, code, signal });
    });
  });
}
