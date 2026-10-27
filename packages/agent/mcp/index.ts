import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { read, grep, edit, glob, del, list, write, mkdir } from './tools/FileSystem/filesystem';
import { webSearch } from './tools/WebTools/webSearch';
import { getWebPage } from './tools/WebTools/getWebPageContent';
import { z } from 'zod';
import { addToMemory } from '../memory/utils/memory';
import { listNotes, readNotes, writeNotes, editNotes } from '../memory/utils/notes';
import {
  ReadToolSchema,
  GrepToolSchema,
  EditToolSchema,
  GlobToolSchema,
  DeleteToolSchema,
  ListToolSchema,
  WriteToolSchema,
  MkdirSchema,
  WebSearchSchema,
  GetWebPageSchema,
} from '@baby-panda/types';

const server = new McpServer({
  name: 'baby-panda/mcp',
  version: '1.0.0',
});

// file system

server.registerTool(
  'read',
  {
    description: 'Read content of a file',
    inputSchema: ReadToolSchema,
  },
  async (args) => {
    console.log('in the read tool', args.path);
    const text: string = await read(args);
    return {
      content: [
        {
          type: 'text',
          text: text,
        },
      ],
    };
  },
);

server.registerTool(
  'grep',
  {
    description: 'Search content across files',
    inputSchema: GrepToolSchema,
  },
  async (args) => {
    const searchResult = await grep(args.path, args.pattern, args.flag);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(searchResult),
        },
      ],
    };
  },
);

server.registerTool(
  'edit',
  {
    description: 'edit content of a pre existing file',
    inputSchema: EditToolSchema,
  },
  async (args) => {
    const edited = await edit(args);
    return {
      content: [{ type: 'text', text: `${edited}` }],
    };
  },
);

server.registerTool(
  'glob',
  {
    description: 'search for files',
    inputSchema: GlobToolSchema,
  },
  async (args) => {
    const result = await glob(args.pattern, args.ignorePatterns);
    return {
      content: [{ type: 'text', text: `${JSON.stringify(result)}` }],
    };
  },
);

server.registerTool(
  'delete',
  {
    description: 'deletes a file',
    inputSchema: DeleteToolSchema,
  },
  async (args) => {
    const deleted = await del(args.path, args.options);
    return {
      content: [{ type: 'text', text: `${deleted}` }],
    };
  },
);

server.registerTool(
  'list',
  {
    description: 'List all the files in a folder',
    inputSchema: ListToolSchema,
  },
  async (args) => {
    const result = await list(args.path);
    return {
      content: [{ type: 'text', text: `${JSON.stringify(result)}` }],
    };
  },
);

server.registerTool(
  'write',
  {
    description: 'Create or overwrite a given file',
    inputSchema: WriteToolSchema,
  },
  async (args) => {
    const result = await write(args.path, args.content);
    return {
      content: [{ type: 'text', text: `${result}` }],
    };
  },
);

server.registerTool(
  'mkdir',
  {
    description: 'Create a new folder',
    inputSchema: MkdirSchema,
  },
  async (args) => {
    const result = await mkdir(args.path);
    return {
      content: [{ type: 'text', text: `${result}` }],
    };
  },
);

// Web

server.registerTool(
  'web_search',
  {
    description: 'Takes in a search query and return links to relevant web pages',
    inputSchema: WebSearchSchema,
  },
  async (args) => {
    const results = await webSearch(args.query);
    return {
      content: [{ type: 'text', text: `${JSON.stringify(results)}` }],
    };
  },
);

server.registerTool(
  'get_web_page',
  {
    description: 'Takes in a search query and return links to relevant web pages',
    inputSchema: GetWebPageSchema,
  },
  async (args) => {
    const results = await getWebPage(args.url);
    return {
      content: [{ type: 'text', text: `${JSON.stringify(results)}` }],
    };
  },
);

// Memory
server.registerTool(
  'add_content_to_memory',
  {
    description: 'Add new information to memory',
    inputSchema: z.object({ content: z.string() }),
  },
  async (args) => {
    const result = await addToMemory(args.content);
    return {
      content: [{ type: 'text', text: `${JSON.stringify(result)}` }],
    };
  },
);

server.registerTool(
  'write_notes',
  {
    description: 'create a new notes file',
    inputSchema: z.object({
      fileName: z.string(),
      content: z.string().default(''),
    }),
  },
  async (args) => {
    const result = await writeNotes(args.fileName, args.content);
    return {
      content: [{ type: 'text', text: `${JSON.stringify(result)}` }],
    };
  },
);

server.registerTool(
  'list_notes',
  {
    description: 'list all the notes files in the current working project',
  },
  async () => {
    const result = await listNotes();
    return {
      content: [{ type: 'text', text: `${JSON.stringify(result)}` }],
    };
  },
);

server.registerTool(
  'read_notes',
  {
    description: 'read notes file',
    inputSchema: z.object({
      fileName: z.string(),
      offset: z.number(),
      limit: z.number(),
    }),
  },
  async (args) => {
    const result = await readNotes(args.fileName, args.offset, args.limit);
    return {
      content: [{ type: 'text', text: result }],
    };
  },
);

server.registerTool(
  'edit_notes',
  {
    description: 'edit notes file',
    inputSchema: z.object({
      fileName: z.string(),
      old_str: z.string(),
      new_str: z.string(),
    }),
  },
  async (args) => {
    const result = await editNotes(args.fileName, args.old_str, args.new_str);
    return {
      content: [{ type: 'text', text: `${result}` }],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Baby panda MCP server is now live');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
