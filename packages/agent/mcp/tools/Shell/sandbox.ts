import { spawn } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import process from 'node:process';

export interface SandboxOptions {
  workspace: string;
  command: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
  allowNetwork?: boolean;
}

export interface SandboxResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  error: string;
  timedOut: boolean;
}

export async function runSandboxed({
  workspace,
  command,
  timeoutMs = 60_000,
  maxOutputBytes = 2_000_000,
  allowNetwork = false,
}: SandboxOptions): Promise<SandboxResult> {
  if (process.platform !== 'linux') {
    throw new Error('Bubblewrap sandboxing is only supported on Linux');
  }

  const resolvedWorkspace = await realpath(workspace);

  const bubblewrapArgs = [
    '--die-with-parent',
    '--new-session',

    // Process and namespace isolation.
    '--unshare-pid',
    '--unshare-uts',
    '--unshare-ipc',
    '--unshare-cgroup',

    // The default is no network access.
    ...(allowNetwork ? [] : ['--unshare-net']),

    // Make the host filesystem visible but read-only.
    '--ro-bind',
    '/',
    '/',

    // Hide common locations containing credentials or host state.
    '--tmpfs',
    '/home',
    '--tmpfs',
    '/root',
    '--tmpfs',
    '/run',

    // Private writable temporary directory.
    '--tmpfs',
    '/tmp',

    // Minimal process and device filesystems.
    '--proc',
    '/proc',
    '--dev',
    '/dev',

    // Only this directory is writable from the host.
    '--bind',
    resolvedWorkspace,
    '/workspace',

    '--chdir',
    '/workspace',

    // Do not inherit host environment variables or credentials.
    '--clearenv',
    '--setenv',
    'PATH',
    '/usr/local/bin:/usr/bin:/bin',
    '--setenv',
    'HOME',
    '/tmp',
    '--setenv',
    'LANG',
    'C.UTF-8',

    '--',
    '/bin/sh',
    '-lc',
    command,
  ];

  return new Promise<SandboxResult>((resolve) => {
    const child = spawn('bwrap', bubblewrapArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });

    let stdout = '';
    const stderr = '';
    let outputBytes = 0;
    let timedOut = false;
    let settled = false;
    let error = '';

    const killProcessGroup = () => {
      if (child.pid === undefined) {
        return;
      }

      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch (error) {
        if (!(error instanceof Error) || !('code' in error)) {
          throw error;
        }
      }
    };

    const appendOutput = (current: string, chunk: Buffer): { value: string; exceeded: boolean } => {
      outputBytes += chunk.byteLength;
      if (outputBytes > maxOutputBytes) {
        return {
          value: current,
          exceeded: true,
        };
      }

      return {
        value: current + chunk.toString('utf-8'),
        exceeded: false,
      };
    };

    const timer = setTimeout(() => {
      timedOut = true;
      killProcessGroup();
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      const result = appendOutput(stdout, chunk);
      stdout = result.value;

      if (result.exceeded) {
        killProcessGroup();
      }
    });
    child.once('error', (err) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        error = err.message;
      }
    });
    child.once('close', (exitCode, signal) => {
      clearTimeout(timer);
      if (settled) {
        return;
      }
      settled = true;
      resolve({
        exitCode,
        signal,
        stdout,
        stderr,
        timedOut,
        error,
      });
    });
  });
}
