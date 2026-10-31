import fs from 'fs';
import path from 'path';
import { LogType } from '@baby-panda/types';
import os from 'os';

export async function writeLogs(
  type: LogType,
  projectName: string,
  sessionId: string,
  content: string,
) {
  const timestamp = Date.now();
  //write to file
  const homeDir = os.homedir();
  const logDirectoryLocation = path.join(homeDir, '.babypanda', 'logs', projectName, sessionId);
  const logTypes = ['mcp', 'agent', 'db', 'cli', 'server'];
  if (!fs.existsSync(logDirectoryLocation)) {
    await fs.promises.mkdir(logDirectoryLocation, { recursive: true });
    await Promise.all(
      logTypes.map((t) =>
        fs.promises.writeFile(
          path.join(logDirectoryLocation, `${t}.log`),
          `${t.toUpperCase()} LOGS\n`,
        ),
      ),
    );
  }

  const writePath = path.join(logDirectoryLocation, type);
  const formattedContent = content.replace(/\r\n/g, '\n').trim().replace(/\n/g, '\n  ');
  const logline = `[${type}: ${timestamp}]: ${formattedContent}\n`;
  try {
    await fs.promises.appendFile(writePath, logline);
  } catch (err) {
    console.log('Failed to appen log file', err);
  }
}
