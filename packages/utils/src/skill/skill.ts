import fs from 'fs';
import path from 'path';
import { getMatchingFolders } from '../getMatchingFolders';
import { getYamlHeaders } from '../getYAMLHeaders';
import { z } from 'zod';
import { fileURLToPath } from 'url';

const skillFoldersNameRegex = /^[a-z]+(-+[a-z]+)*$/;

const SkillHeadersSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase, digits, single hyphens only'),
  description: z.string().nonempty(),
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SkillFile {
  name: string;
  description: string;
  filePath: string;
}

export async function getSkillsFiles(): Promise<SkillFile[]> {
  const skillDirectoryPath = path.join(process.cwd(), '.babypanda', 'skills');
  const exist = fs.existsSync(skillDirectoryPath) && fs.lstatSync(skillDirectoryPath).isDirectory();
  if (!exist) {
    return [];
  }
  const skillsFolders = await getMatchingFolders(process.cwd(), skillFoldersNameRegex);
  const skillFiles = await Promise.all(
    skillsFolders.map(async (folder) => {
      const filePath = path.join(folder, 'SKILL.md');
      try {
        await fs.promises.access(filePath);

        const schemaCheck = await getYamlHeaders(SkillHeadersSchema, filePath);
        return schemaCheck.success ? ({ ...schemaCheck.headers, filePath } as SkillFile) : null;
      } catch {
        return null;
      }
    }),
  );
  const result = skillFiles.filter((item): item is SkillFile => item !== null);
  return result;
}

export async function getSkillsInstructions(): Promise<string> {
  const filePath = path.join(__dirname, 'SKILLS.md');
  const content = await fs.promises.readFile(filePath, 'utf-8');
  return content;
}
