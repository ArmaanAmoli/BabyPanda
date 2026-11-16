import path from 'path';
import os from 'os';
import formatPath from '../utils/formatPath';
import fs from 'fs';

const cwd = process.cwd();
const projectName = formatPath(cwd);
const home = os.homedir();
const babyPandaRoot = path.join(home, '.babypanda');
const babyPandaDir = path.join(home, '.babypanda', 'projects');
const projectDir = path.join(babyPandaDir, projectName);
const memoryFile = path.join(babyPandaDir, projectName, 'MEMORY.md');

async function ensureExistanceOfRequiredFolders() {
  if (!(
    (await fs.promises.exists(babyPandaRoot)) &&
    (await fs.promises.lstat(babyPandaRoot)).isDirectory()
  )) {
    await fs.promises.mkdir(babyPandaRoot);
  }
  if (!(
    (await fs.promises.exists(babyPandaDir)) &&
    (await fs.promises.lstat(babyPandaDir)).isDirectory()
  )) {
    await fs.promises.mkdir(babyPandaDir);
  }
  if (!(
    (await fs.promises.exists(projectDir)) && (await fs.promises.lstat(projectDir)).isDirectory()
  )) {
    await fs.promises.mkdir(projectDir);
  }
  if (!(await fs.promises.exists(memoryFile))) {
    await fs.promises.writeFile(memoryFile, '');
  }
}
export { projectName, babyPandaDir, projectDir, memoryFile, ensureExistanceOfRequiredFolders };
