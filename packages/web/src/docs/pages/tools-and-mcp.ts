import type { DocPage } from '../types';

const page: DocPage = {
  slug: 'tools-and-mcp',
  group: 'Concepts',
  category: 'Concepts',
  title: 'Tools and MCP',
  subtitle: 'What the agent can do to your machine, and how each call is shown to you.',
  blocks: [
    {
      kind: 'p',
      text: 'Every capability the model has is an MCP tool. The agent builds an `McpServer` in-process, connects a `Client` to it over an in-memory transport pair, and advertises the resulting tool list to the provider. Because both ends live in the same process there is no stdio pipe to spawn — but the boundary is the real MCP one, so a tool could just as easily be served by a separate process.',
    },
    { kind: 'heading', level: 2, text: 'How tools are wired' },
    {
      kind: 'code',
      lang: 'ts',
      title: 'packages/agent/mcp/index.ts',
      code: "export function createMCPServer(): McpServer {\n  const server = new McpServer({ name: 'baby-panda/mcp', version: '1.0.0' });\n\n  server.registerTool(\n    'read',\n    { description: 'Read content of a file', inputSchema: ReadToolSchema },\n    async (args) => {\n      const text: string = await read(args);\n      return { content: [{ type: 'text', text }] };\n    },\n  );\n\n  // …\n  return server;\n}",
    },
    {
      kind: 'p',
      text: 'The client lists the tools on connect and maps each one to the `{name, description, input_schema}` shape the provider expects. The tool list sent with a request is rebuilt every turn, so a key saved mid-session takes effect on the next one.',
    },
    { kind: 'heading', level: 2, text: 'The tool list' },
    {
      kind: 'table',
      head: ['Tool', 'What it does'],
      rows: [
        ['`read`', 'Read a file, with an optional line offset and limit'],
        ['`grep`', 'Recursive content search returning `path:line:match` rows'],
        ['`glob`', 'Find files matching a glob pattern'],
        ['`list`', 'List the entries of a folder'],
        ['`write`', 'Create or overwrite a file'],
        ['`edit`', 'Replace an exact string in an existing file'],
        ['`mkdir`', 'Create a folder'],
        ['`delete`', 'Delete a file or directory'],
        ['`shell`', 'Execute a shell command in the current project'],
        ['`web_search`', 'Search the web and return relevant links'],
        ['`get_web_page`', 'Fetch the content of one or more web pages'],
        ['`add_content_to_memory`', 'Append a durable fact to project memory'],
        [
          '`write_notes` / `list_notes` / `read_notes` / `edit_notes`',
          'Task-scoped notes for the project',
        ],
        ['`readSkill` / `addSkill`', 'Read a skill’s instructions, or create a new one'],
      ],
    },
    {
      kind: 'p',
      text: 'The two web tools are opt-in. They are only offered to the model when an Exa key is configured, and when it is not, a system message says so explicitly — an unconfigured install never advertises a tool that cannot run, and the model is told why so it does not invent a workaround.',
    },
    { kind: 'heading', level: 2, text: 'Permissions' },
    {
      kind: 'p',
      text: 'A tool call does not run until you allow it. The agent emits a permission event carrying the tool name and its arguments, the server forwards it to the terminal, and the terminal asks. The agent parks a waiter keyed by the tool-call id and resumes when the decision arrives.',
    },
    {
      kind: 'table',
      head: ['Decision', 'Effect'],
      rows: [
        ['Allow', 'Runs this call only'],
        ['Always Allow', 'Runs this and every later `shell` call in the session'],
        ['Don\u2019t Allow', 'The call is refused and the reason goes back to the model'],
      ],
    },
    {
      kind: 'p',
      text: 'The "always allow" flag is deliberately not persisted: it lives on the agent instance, so closing the session resets it.',
    },
    { kind: 'heading', level: 2, text: 'The shell sandbox' },
    {
      kind: 'p',
      text: '`/sandbox` toggles an optional bubblewrap sandbox for shell calls. It unshares the pid, uts, ipc and cgroup namespaces, bind-mounts the host filesystem read-only except for the workspace, and drops network access. It is Linux-only — anywhere else the sandbox throws rather than silently running unsandboxed.',
    },
    { kind: 'heading', level: 2, text: 'How tool calls render' },
    {
      kind: 'p',
      text: 'Each call is a bullet: a status-coloured dot, the verb, and a dim target. Clicking the bullet — or pressing `Space` on a focused one — expands that call’s detail, which is a unified diff for `write` and `edit`, the command for `shell`, and the raw result otherwise.',
    },
    {
      kind: 'code',
      lang: 'text',
      code: "■ 2 tools\n  ● read   packages/agent/config/tools.ts\n  ● edit   packages/web/src/content.ts\n       - { label: 'GitHub', href: '…' }\n       + { label: 'Docs', href: '/BabyPanda/docs/' }",
    },
    {
      kind: 'p',
      text: 'A batch of calls in one assistant message folds into a single `■ N tools` root, so a long run stays scannable. Results are persisted as `tool` messages keyed by `tool_call_id`, which is what lets the provider stitch them back onto the calls that produced them.',
    },
    {
      kind: 'callout',
      variant: 'note',
      title: 'Exit codes',
      text: 'For `grep`, exit code 1 only means "no matches"; exit code 2 means grep itself failed, and that is surfaced as a tool error rather than an empty result.',
    },
  ],
};

export default page;
