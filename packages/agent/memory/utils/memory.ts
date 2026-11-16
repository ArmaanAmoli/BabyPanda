import { read, write } from '../../mcp/tools/FileSystem/filesystem';
import { ensureExistanceOfRequiredFolders, memoryFile } from '../constants';

//write memory
export async function addToMemory(content: string) {
  await ensureExistanceOfRequiredFolders();
  const oldMemory = await readFromMemory();
  const existing = oldMemory ? oldMemory.trim() : '';
  const newMemory = existing ? `${content}\n${existing}\n` : `${content}\n`;
  await write(memoryFile, newMemory);
  return true;
}

//read memory (200 lines)
export async function readFromMemory() {
  await ensureExistanceOfRequiredFolders();
  const content = await read({ path: memoryFile, offset: 1, limit: 200 });
  return content;
}
