import { z } from 'zod';

export interface ModelTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
      additionalProperties?: boolean;
    };
  };
}

// export interface AgentToolCallUncertain {
//   index: number;
//   id?: string;
//   type?: 'function';
//   function?: {
//     name?: string;
//     arguments?: string;
//   };
// }

export const AgentToolCallSchemaUncertain = z.object({
  index: z.number(),
  id: z.string().optional(),
  type: z.literal('function').optional(),
  function: z
    .object({
      name: z.string().optional(),
      arguments: z.string().optional(),
    })
    .optional(),
});

export type AgentToolCallUncertain = z.infer<typeof AgentToolCallSchemaUncertain>;

export const AgentToolCallSchema = z.object({
  index: z.number(),
  id: z.string(),
  type: z.literal('function'),
  function: z.object({
    name: z.string(),
    arguments: z.string(),
  }),
});

export type AgentToolCall = z.infer<typeof AgentToolCallSchema>;

// export interface AgentToolCallMessage {
//   role: 'assistant';
//   content: string | null;
//   tool_calls: AgentToolCall[];
// }

// export interface AgentToolCallResponse {
//   message: AgentToolCallMessage;
// }

export const tools: ModelTool[] = [
  {
    type: 'function',
    function: {
      name: 'shell',
      description: 'Execute a shell command in the current project.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', minLength: 1 },
          timeout: { type: 'integer', minimum: 1, maximum: 600000, default: 120000 },
        },
        required: ['command'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read',
      description: 'Read content of a file.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Location of the file.' },
          offset: { type: 'number', description: 'Starting line number.' },
          limit: { type: 'number', description: 'Number of lines to read.' },
        },
        required: ['path'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'grep',
      description: 'Search content across files.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory or file to search.' },
          pattern: { type: 'string', description: 'Regular expression to search for.' },
          flag: { type: 'string', description: 'Optional search flags.' },
        },
        required: ['path', 'pattern'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit',
      description: 'Replace text in an existing file.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          old_str: { type: 'string' },
          new_str: { type: 'string' },
        },
        required: ['path', 'old_str', 'new_str'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'glob',
      description: 'Find files matching a glob pattern.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string' },
          ignorePatterns: { type: 'array', items: { type: 'string' } },
        },
        required: ['pattern'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete',
      description: 'Delete a file or directory.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          options: {
            type: 'object',
            properties: {
              force: { type: 'boolean', default: false },
              maxRetries: { type: 'number', default: 0 },
              recursive: { type: 'boolean', default: false },
              retryDelay: { type: 'number', default: 100 },
            },
            additionalProperties: false,
          },
        },
        required: ['path'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list',
      description: 'List files in a folder.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write',
      description: 'Create or overwrite a file.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['path', 'content'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mkdir',
      description: 'Create a folder.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web and return relevant links.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_web_page',
      description: 'Fetch content from one or more web pages.',
      parameters: {
        type: 'object',
        properties: { url: { type: 'array', items: { type: 'string' } } },
        required: ['url'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_content_to_memory',
      description: 'Add durable project information to memory.',
      parameters: {
        type: 'object',
        properties: { content: { type: 'string' } },
        required: ['content'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_notes',
      description: 'Create or overwrite a project notes file.',
      parameters: {
        type: 'object',
        properties: {
          fileName: { type: 'string' },
          content: { type: 'string', default: '' },
        },
        required: ['fileName'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_notes',
      description: 'List project notes files.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_notes',
      description: 'Read a project notes file.',
      parameters: {
        type: 'object',
        properties: {
          fileName: { type: 'string' },
          offset: { type: 'number' },
          limit: { type: 'number' },
        },
        required: ['fileName', 'offset', 'limit'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_notes',
      description: 'Replace text in a project notes file.',
      parameters: {
        type: 'object',
        properties: {
          fileName: { type: 'string' },
          old_str: { type: 'string' },
          new_str: { type: 'string' },
        },
        required: ['fileName', 'old_str', 'new_str'],
        additionalProperties: false,
      },
    },
  },
];
