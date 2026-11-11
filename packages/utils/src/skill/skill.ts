import fs from 'fs';
import os from 'os';
import path from 'path';
import { getMatchingFolders } from '../getMatchingFolders';
import { getYamlHeaders } from '../getYAMLHeaders';
import { z } from 'zod';
import { fileURLToPath } from 'url';

const skillFoldersNameRegex = /^[a-z]+(-+[a-z]+)*$/;

// `arguments` / `argument-hint` are accepted both as plain strings
// ("name type", "[name] [type]") and as YAML flow sequences, so both shapes
// are normalized to strings.
const stringOrList = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    if (value == null) return undefined;
    return Array.isArray(value) ? value.join(' ') : value;
  });

const SkillHeadersSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase, digits, single hyphens only'),
  description: z.string().nonempty(),
  arguments: stringOrList,
  'argument-hint': stringOrList,
  'disable-model-invocation': z.boolean().optional().default(false),
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type SkillSource = 'global' | 'project';

export interface SkillFile {
  name: string;
  description: string;
  filePath: string;
  source: SkillSource;
  /** Positional argument names declared in the frontmatter, in order. */
  arguments?: string[];
  /** Display string for the declared arguments, e.g. "[name] [type]". */
  argumentHint?: string;
  /** When true the skill is user-only: hidden from the agent and readSkill. */
  disableModelInvocation: boolean;
}

export interface SkillDirs {
  cwd: string;
  home: string;
}

function defaultDirs(): SkillDirs {
  return { cwd: process.cwd(), home: os.homedir() };
}

async function scanSkillDir(dir: string, source: SkillSource): Promise<SkillFile[]> {
  const exists = fs.existsSync(dir) && fs.lstatSync(dir).isDirectory();
  if (!exists) {
    return [];
  }
  const skillFolders = await getMatchingFolders(dir, skillFoldersNameRegex);
  const skillFiles = await Promise.all(
    skillFolders.map(async (folder) => {
      const filePath = path.join(folder, 'SKILL.md');
      try {
        await fs.promises.access(filePath);
        const schemaCheck = await getYamlHeaders(SkillHeadersSchema, filePath);
        if (!schemaCheck.success) return null;
        const {
          name,
          description,
          arguments: args,
          'argument-hint': hint,
          'disable-model-invocation': disable,
        } = schemaCheck.headers;
        return {
          name,
          description,
          filePath,
          source,
          arguments: args ? args.split(/\s+/).filter(Boolean) : undefined,
          argumentHint: hint,
          disableModelInvocation: disable,
        } as SkillFile;
      } catch {
        return null;
      }
    }),
  );
  return skillFiles.filter((item): item is SkillFile => item !== null);
}

/**
 * Lists every discoverable skill: the union of the global tier
 * (`~/.babypanda/skills/<name>/SKILL.md`, available in every project) and the
 * project tier (`<cwd>/.babypanda/skills/<name>/SKILL.md`). On a name collision
 * the project skill shadows the global one.
 */
export async function getSkillsFiles(dirs: Partial<SkillDirs> = {}): Promise<SkillFile[]> {
  const { cwd, home } = { ...defaultDirs(), ...dirs };
  const globalSkills = await scanSkillDir(path.join(home, '.babypanda', 'skills'), 'global');
  const projectSkills = await scanSkillDir(path.join(cwd, '.babypanda', 'skills'), 'project');
  const byName = new Map<string, SkillFile>();
  for (const skill of [...globalSkills, ...projectSkills]) {
    byName.set(skill.name, skill); // project tier is applied last, so it wins
  }
  return [...byName.values()];
}

/**
 * Resolves a single skill by name with project-tier precedence.
 */
export async function getSkillByName(
  name: string,
  dirs: Partial<SkillDirs> = {},
): Promise<SkillFile | null> {
  const skills = await getSkillsFiles(dirs);
  return skills.find((skill) => skill.name === name) ?? null;
}

/**
 * Reads a SKILL.md file and returns only the markdown body (YAML frontmatter
 * stripped).
 */
export async function readSkillBody(filePath: string): Promise<string> {
  const result = await getYamlHeaders(SkillHeadersSchema, filePath);
  if (!result.success) {
    throw new Error(`Invalid SKILL.md frontmatter: ${filePath}`);
  }
  return result.content;
}

/**
 * Substitutes positional `$<arg>` placeholders in a skill body. Tokens from
 * `args` are assigned to `argNames` in order; tokens beyond the declared
 * arguments are returned as `leftover` (the user's actual message). Missing
 * arguments leave the `$placeholder` untouched.
 */
export function applySkillArguments(
  body: string,
  argNames: string[],
  args: string,
): { content: string; leftover: string } {
  const tokens = args.split(/\s+/).filter((token) => token.length > 0);
  let content = body;
  argNames.forEach((argName, index) => {
    const token = tokens[index];
    if (token === undefined) return; // missing arg: keep the placeholder as-is
    content = content.split(`$${argName}`).join(token);
  });
  const leftover = tokens.slice(argNames.length).join(' ');
  return { content, leftover };
}

/**
 * Wraps a skill body in the `<skill>` tag so the model can recognize
 * user-injected skill instructions (the tag is explained in the system
 * instructions).
 */
export function wrapSkillContent(name: string, body: string): string {
  return `<skill name="${name}">\n${body}\n</skill>`;
}

export async function getSkillsInstructions(): Promise<string> {
  const filePath = path.join(__dirname, 'SKILLS.md');
  const content = await fs.promises.readFile(filePath, 'utf-8');
  return content;
}
