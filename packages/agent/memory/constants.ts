import path from 'path';
import os from 'os';
import formatPath from '../utils/formatPath';

const cwd = process.cwd();
const projectName = formatPath(cwd);
const home = os.homedir();
const babyPandaDir = path.join(home, '.babypanda', 'projects');
const projectDir = path.join(babyPandaDir , projectName);
const memoryFile = path.join(babyPandaDir , projectName , 'MEMORY.md');


export { projectName , babyPandaDir , projectDir , memoryFile};