import type { DocPage } from '../types';

const page: DocPage = {
  slug: 'memory',
  group: 'Concepts',
  category: 'Concepts',
  title: 'Memory',
  subtitle: 'Durable, project-scoped facts that survive a session.',
  blocks: [
    {
      kind: 'p',
      text: 'Memory is the long-term half of BabyPanda’s context. A session’s message history is thrown away when you close the terminal; memory is not. It is a plain Markdown file per project, read into the context on every turn, and written by the model through a tool.',
    },
    { kind: 'heading', level: 2, text: 'Where memory lives' },
    {
      kind: 'code',
      lang: 'text',
      code: '~/.babypanda/\n├── db/\n│   ├── db.db            # the normal database\n│   └── db.test.db       # used when IN_DEV_MODE=true\n├── logs/<project>/<sessionId>.log\n└── projects/<project-name>/\n    ├── MEMORY.md         # durable project facts\n    └── <note>.md         # task- or topic-scoped notes',
    },
    {
      kind: 'p',
      text: 'The project directory is derived from the working directory, so two checkouts of the same repository in different folders keep separate memories. The folders and an empty `MEMORY.md` are created on first run.',
    },
    { kind: 'heading', level: 2, text: 'Reading and writing' },
    {
      kind: 'p',
      text: '`add_content_to_memory` prepends the new fact to the top of `MEMORY.md`, so the most recent information is read first. `readFromMemory` reads the first 200 lines, which is the budget the context gives it.',
    },
    {
      kind: 'code',
      lang: 'ts',
      title: 'packages/agent/memory/utils/memory.ts',
      code: "export async function addToMemory(content: string) {\n  await ensureExistanceOfRequiredFolders();\n  const oldMemory = await readFromMemory();\n  const existing = oldMemory ? oldMemory.trim() : '';\n  const newMemory = existing ? `${content}\\n${existing}\\n` : `${content}\\n`;\n  await write(memoryFile, newMemory);\n  return true;\n}",
    },
    {
      kind: 'callout',
      variant: 'note',
      title: 'What belongs in memory',
      text: 'Stable, reusable facts: the package manager the project uses, where the migrations live, which test command is authoritative. Not secrets, not credentials, not temporary plans, and not task progress — that is what notes are for.',
    },
    { kind: 'heading', level: 2, text: 'Notes' },
    {
      kind: 'p',
      text: 'Notes are the task-scoped counterpart. They live beside `MEMORY.md` as one Markdown file each, and are managed with four tools:',
    },
    {
      kind: 'table',
      head: ['Tool', 'Effect'],
      rows: [
        ['`write_notes`', 'Create or overwrite `<fileName>.md`'],
        ['`list_notes`', 'List the note files in the current project'],
        ['`read_notes`', 'Read a note, with an offset and a limit'],
        ['`edit_notes`', 'Replace an exact string inside a note'],
      ],
    },
    {
      kind: 'p',
      text: 'Notes survive compaction, which makes them the place to park a plan that has to outlive a context reset. Keep them short and factual.',
    },
    { kind: 'heading', level: 2, text: 'Skills' },
    {
      kind: 'p',
      text: 'Skills are reusable instruction sets stored as `SKILL.md` files. They are discovered from `~/.babypanda/skills` (global) and `./.babypanda/skills` (project), with the project taking precedence. A skill can be marked `disable-model-invocation`, which hides it from the model entirely and makes it activatable only by the user typing `/<name>`.',
    },
    {
      kind: 'p',
      text: 'The list of model-visible skills is injected as a system message and re-synced whenever a skill is added mid-session, so a new skill is visible on the next turn rather than after the next compaction.',
    },
    { kind: 'heading', level: 2, text: 'What memory is not' },
    {
      kind: 'list',
      items: [
        'It is not a vector store or an embedding index — it is a text file read in full, up to 200 lines.',
        'It is not shared between projects, or between two checkouts of the same project in different folders.',
        'It is not encrypted. Treat it as part of your working directory and keep secrets out of it.',
      ],
    },
  ],
};

export default page;
