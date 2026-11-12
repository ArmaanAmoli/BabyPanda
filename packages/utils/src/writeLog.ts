import fs from 'fs';
import path from 'path';
import { LogType } from '@baby-panda/types';
import os from 'os';
import { formatErrorChain } from './formatErrorChain';

/** Default log retention window, in days. Overridable via `BABY_PANDA_LOG_TTL_DAYS`. */
export const DEFAULT_LOG_TTL_DAYS = 7;

/** Environment variable that overrides the default log retention window. */
export const LOG_TTL_ENV_VAR = 'BABY_PANDA_LOG_TTL_DAYS';

/** Resolve the retention window (in days) from the environment, falling back to the default. */
export function resolveLogTtlDays(): number {
  const raw = process.env[LOG_TTL_ENV_VAR];
  if (raw === undefined || raw === '') return DEFAULT_LOG_TTL_DAYS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_LOG_TTL_DAYS;
}

/** Collapse a value onto a single physical line so each log entry stays grep-friendly. */
function flattenToLine(value: string): string {
  return value.replace(/\r?\n\s*/g, ' ').trim();
}

/** Flatten an error chain onto one line, marking each causal level with ` <- `. */
function flattenChain(value: string): string {
  return value.replace(/\r?\n\s*/g, ' <- ').trim();
}

/** Render the subsystem tag (e.g. `agent`) from a LogType value (e.g. `agent.log`). */
function logTypeTag(type: LogType): string {
  return type.replace(/\.log$/, '');
}

/** Default logs root: `~/.babypanda/logs`. Overridable per-call for testing. */
function defaultLogsDir(): string {
  return path.join(os.homedir(), '.babypanda', 'logs');
}

/**
 * Append a single error entry to the per-session log file.
 *
 * All log types for a session share one file (`<sessionId>.log` under the project
 * folder) and each entry is one grep-friendly physical line:
 *   `[<type>] <ISO-8601 timestamp> ERROR: <description> | cause: <flattened chain>`
 */
export async function logError(
  type: LogType,
  projectName: string,
  sessionId: string,
  description: string,
  cause?: unknown,
  baseDir: string = defaultLogsDir(),
) {
  const logDirectoryLocation = path.join(baseDir, projectName);
  const writePath = path.join(logDirectoryLocation, `${sessionId}.log`);
  const timestamp = new Date().toISOString();
  const descriptionLine = flattenToLine(description);
  const causeSuffix =
    cause === undefined || cause === null
      ? ''
      : ` | cause: ${flattenChain(formatErrorChain(cause))}`;
  const logline = `[${logTypeTag(type)}] ${timestamp} ERROR: ${descriptionLine}${causeSuffix}\n`;
  try {
    await fs.promises.mkdir(logDirectoryLocation, { recursive: true });
    await fs.promises.appendFile(writePath, logline);
  } catch (err) {
    console.error('Failed to write error log file', err);
  }
}

/**
 * Delete logs older than the retention window so the logs tree stays temporary.
 *
 * Handles both layouts: the legacy per-session directory of per-type `.log` files
 * and the current single `<sessionId>.log` file per session. Age is measured by
 * last-modified time, so a session that is still being written to is never removed.
 */
export async function cleanOldLogs(
  ttlDays: number,
  baseDir: string = defaultLogsDir(),
): Promise<void> {
  const logsRoot = baseDir;
  const cutoff = Date.now() - ttlDays * 24 * 60 * 60 * 1000;

  let projectEntries: fs.Dirent[];
  try {
    projectEntries = await fs.promises.readdir(logsRoot, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
    console.error('Failed to read logs root during cleanup', err);
    return;
  }

  for (const projectEntry of projectEntries) {
    if (!projectEntry.isDirectory()) continue;
    const projectDir = path.join(logsRoot, projectEntry.name);

    let sessionEntries: fs.Dirent[];
    try {
      sessionEntries = await fs.promises.readdir(projectDir, { withFileTypes: true });
    } catch (err) {
      console.error('Failed to read log project directory during cleanup', projectDir, err);
      continue;
    }

    for (const sessionEntry of sessionEntries) {
      const sessionPath = path.join(projectDir, sessionEntry.name);
      try {
        if (sessionEntry.isDirectory()) {
          // Legacy layout: a session folder holding per-type `.log` files.
          const files = await fs.promises.readdir(sessionPath);
          let newest = 0;
          for (const file of files) {
            const stat = await fs.promises.stat(path.join(sessionPath, file));
            if (stat.mtimeMs > newest) newest = stat.mtimeMs;
          }
          if (newest < cutoff) {
            await fs.promises.rm(sessionPath, { recursive: true, force: true });
          }
        } else if (sessionEntry.isFile() && sessionEntry.name.endsWith('.log')) {
          // Current layout: a single `<sessionId>.log` file per session.
          const stat = await fs.promises.stat(sessionPath);
          if (stat.mtimeMs < cutoff) {
            await fs.promises.unlink(sessionPath);
          }
        }
      } catch (err) {
        console.error('Failed to clean log entry', sessionPath, err);
      }
    }
  }
}
