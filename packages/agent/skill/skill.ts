import fs from 'fs';
import path from 'path';
import { getMatchingFolders } from '../utils/getMatchingFolders';
import { getYamlHeaders } from '../utils/getYAMLHeaders';
import { z } from 'zod';

const skillFoldersNameRegex = /^[a-z]+(-+[a-z]+)*$/;

const SkillHeadersSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase, digits, single hyphens only'),
  description: z.string().nonempty(),
});

interface SkillFile {
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
