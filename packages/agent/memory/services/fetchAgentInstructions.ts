import fs from 'fs';
import path from 'path';
import os from 'os';
import { Role, type SystemMessage } from '@baby-panda/types';

const homedir = os.homedir();
const rootAgentFilePath = path.join(homedir, '.babypanda', 'BABYPANDA.md');

async function searchInstructionFiles() {
  const files: string[] = [];

  let currentPath = process.cwd();
  while (true) {
    const file = await getAgentInstructionFilesPaths(currentPath);
    if (file !== null) {
      files.push(file);
    }
    if (currentPath == homedir) {
      break;
    }
    currentPath = path.dirname(currentPath);
  }

  if (await fs.promises.exists(rootAgentFilePath)) {
    files.push(rootAgentFilePath);
  }
  return files.reverse();
}

async function getAgentInstructionFilesPaths(currentLocation: string) {
  const instructionFilesPossibleNames = ['BABYPANDA.md', 'AGENTS.md'];
  const agentFilesPossiblePaths = instructionFilesPossibleNames.map((name) => {
    return path.join(currentLocation, name);
  });
  let result = null;
  for (const paths in agentFilesPossiblePaths) {
    const exist = await fs.promises.exists(paths);
    if (exist) {
      result = paths;
      break;
    }
  }
  return result;
}

export async function getAgentInstructions() {
  const filePaths = await searchInstructionFiles();
  const contents: SystemMessage[] = [];
  for (const file in filePaths) {
    const content = await readAgentFile(file);
    contents.push({ role: Role.system, content });
  }
  return contents;
}

async function readAgentFile(filePath: string): Promise<string> {
  const MAX_BYTES = 64 * 1024; // 65,536 bytes
  //open file

  const fileHandler = await fs.promises.open(filePath, 'r');

  try {
    // allocating buffer
    const buffer = Buffer.alloc(MAX_BYTES);

    // read up to MAX_BYTES of a file
    const { bytesRead } = await fileHandler.read(buffer, 0, MAX_BYTES, 0);
    let text = buffer.toString('utf-8', 0, bytesRead);

    if (bytesRead === MAX_BYTES && text.endsWith('')) {
      text = text.replace(/\ufffd+$/, '');
    }
    return text;
  } finally {
    await fileHandler.close();
  }
}
