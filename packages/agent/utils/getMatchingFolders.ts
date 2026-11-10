import fs from 'fs';
import path from 'path';

export async function getMatchingFolders(dirPath: string, regex: RegExp): Promise<string[]> {
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  const matchingFolders = entries
    .filter((entry) => entry.isDirectory() && regex.test(entry.name))
    .map((entry) => path.join(dirPath, entry.name));
  return matchingFolders;
}
