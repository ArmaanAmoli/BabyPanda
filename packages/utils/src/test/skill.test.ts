import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import {
  getSkillsFiles,
  getSkillByName,
  readSkillBody,
  applySkillArguments,
  wrapSkillContent,
} from '../skill/skill';

let home: string;
let cwd: string;

function writeSkill(root: string, folder: string, frontmatter: string, body: string) {
  const dir = path.join(root, '.babypanda', 'skills', folder);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'SKILL.md'), `---\n${frontmatter}\n---\n\n${body}\n`);
}

beforeEach(() => {
  home = mkdtempSync(path.join(tmpdir(), 'bp-home-'));
  cwd = mkdtempSync(path.join(tmpdir(), 'bp-cwd-'));
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
  rmSync(cwd, { recursive: true, force: true });
});

describe('getSkillsFiles two-tier discovery', () => {
  test('unions global and project tiers with source tags', async () => {
    writeSkill(home, 'github', 'name: github\ndescription: GitHub workflows', 'Use gh.');
    writeSkill(cwd, 'grill', 'name: grill\ndescription: Grill the user', 'Ask questions.');

    const skills = await getSkillsFiles({ cwd, home });
    const byName = new Map(skills.map((s) => [s.name, s]));
    expect(byName.get('github')?.source).toBe('global');
    expect(byName.get('grill')?.source).toBe('project');
    expect(skills).toHaveLength(2);
  });

  test('project skill shadows global skill on name collision', async () => {
    writeSkill(home, 'deploy', 'name: deploy\ndescription: global deploy', 'Global body.');
    writeSkill(cwd, 'deploy', 'name: deploy\ndescription: project deploy', 'Project body.');

    const skills = await getSkillsFiles({ cwd, home });
    expect(skills).toHaveLength(1);
    expect(skills[0]?.source).toBe('project');
    expect(skills[0]?.description).toBe('project deploy');
  });

  test('skips folders without a valid SKILL.md', async () => {
    writeSkill(cwd, 'good', 'name: good\ndescription: ok', 'Body.');
    const badDir = path.join(cwd, '.babypanda', 'skills', 'bad');
    mkdirSync(badDir, { recursive: true });
    writeFileSync(path.join(badDir, 'SKILL.md'), '---\ndescription: no name\n---\nBody.\n');
    mkdirSync(path.join(cwd, '.babypanda', 'skills', 'nofile'), { recursive: true });

    const skills = await getSkillsFiles({ cwd, home });
    expect(skills.map((s) => s.name)).toEqual(['good']);
  });

  test('returns empty when no skills directories exist', async () => {
    expect(await getSkillsFiles({ cwd, home })).toEqual([]);
  });

  test('parses arguments, argument-hint and disable-model-invocation', async () => {
    writeSkill(
      cwd,
      'component',
      'name: component\ndescription: Scaffold a component\narguments: name type\nargument-hint: "[name] [type]"\ndisable-model-invocation: true',
      'Create $name of type $type.',
    );
    const [skill] = await getSkillsFiles({ cwd, home });
    expect(skill?.arguments).toEqual(['name', 'type']);
    expect(skill?.argumentHint).toBe('[name] [type]');
    expect(skill?.disableModelInvocation).toBe(true);
  });

  test('disable-model-invocation defaults to false', async () => {
    writeSkill(cwd, 'plain', 'name: plain\ndescription: plain skill', 'Body.');
    const [skill] = await getSkillsFiles({ cwd, home });
    expect(skill?.disableModelInvocation).toBe(false);
    expect(skill?.arguments).toBeUndefined();
  });
});

describe('getSkillByName', () => {
  test('resolves with project precedence', async () => {
    writeSkill(home, 'shared', 'name: shared\ndescription: global', 'Global.');
    writeSkill(cwd, 'shared', 'name: shared\ndescription: project', 'Project.');
    const skill = await getSkillByName('shared', { cwd, home });
    expect(skill?.source).toBe('project');
    expect(await getSkillByName('missing', { cwd, home })).toBeNull();
  });
});

describe('readSkillBody', () => {
  test('returns only the markdown body, frontmatter stripped', async () => {
    writeSkill(cwd, 'body', 'name: body\ndescription: d', 'Line one.\nLine two.');
    const [skill] = await getSkillsFiles({ cwd, home });
    const body = await readSkillBody(skill!.filePath);
    expect(body.trim()).toBe('Line one.\nLine two.');
    expect(body).not.toContain('description');
  });
});

describe('applySkillArguments', () => {
  test('substitutes positional $args and returns leftover as the user message', () => {
    const { content, leftover } = applySkillArguments(
      'Create $name of type $type.',
      ['name', 'type'],
      'MyComp widget fix the login bug',
    );
    expect(content).toBe('Create MyComp of type widget.');
    expect(leftover).toBe('fix the login bug');
  });

  test('missing arguments leave the placeholder untouched', () => {
    const { content, leftover } = applySkillArguments(
      'Create $name of type $type.',
      ['name', 'type'],
      'MyComp',
    );
    expect(content).toBe('Create MyComp of type $type.');
    expect(leftover).toBe('');
  });

  test('no declared arguments: everything is leftover, body unchanged', () => {
    const { content, leftover } = applySkillArguments('Do the thing.', [], 'please now');
    expect(content).toBe('Do the thing.');
    expect(leftover).toBe('please now');
  });

  test('repeated placeholders are all replaced', () => {
    const { content } = applySkillArguments('$name and again $name', ['name'], 'Bob');
    expect(content).toBe('Bob and again Bob');
  });
});

describe('wrapSkillContent', () => {
  test('wraps the body in a <skill name> tag', () => {
    expect(wrapSkillContent('grill', 'Ask questions.')).toBe(
      '<skill name="grill">\nAsk questions.\n</skill>',
    );
  });
});
