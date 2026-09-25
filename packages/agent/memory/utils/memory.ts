import { read, write } from '../../mcp/tools/FileSystem/filesystem';
import { memoryFile } from '../constants'

//write memory
export async function addToMemory(content: string) {
  const oldMemory = await readFromMemory();
  console.log("old memory:", oldMemory);
  const existing = oldMemory ? oldMemory.trim() : "";
  const newMemory = existing ? `${content}\n${existing}\n` : `${content}\n`;
  console.log("new memory:", newMemory);
  await write(memoryFile, newMemory);
  return true;
}

//read memory (200 lines)
export async function readFromMemory() {
  console.log("memory file: ", memoryFile)
  console.log("Read")
  const content = await read({ path: memoryFile, offset: 1, limit: 200 });
  return content;
}
