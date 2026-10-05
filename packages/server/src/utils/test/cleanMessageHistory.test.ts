import { expect, test, describe } from 'bun:test';
import { cleanMessageHistroy } from '../cleanMessageHistory';
import { Role } from '@baby-panda/types';

// sample inputs
const bashInput = [
  {
    messageIndex: 0,
    sessionId: 'session',
    createdAt: 1,
    role: Role.user,
    isToolResult: true,
    content: JSON.stringify({
      id: 'tool-1',
      name: 'shell',
      arguments: {
        command: 'printf \'{"status":"ok"}\'',
        timeout: 120000,
      },
      result: JSON.stringify({
        stdout: '{"status":"ok"}',
        stderr: '',
        error: '',
        code: 0,
        signal: null,
      }),
      error: '',
    }),
  },
];

const multipleMessages = [
  {
    messageIndex: 0,
    sessionId: 'session',
    createdAt: 1,
    role: Role.assistant,
    isToolResult: false,
    content: JSON.stringify({
      role: Role.assistant,
      content: {
        thought: 'The user wants to read file in the current working directory.',
      },
    }),
  },

  {
    messageIndex: 1,
    sessionId: 'session',
    createdAt: 3,
    role: Role.user,
    isToolResult: true,
    content: JSON.stringify({
      id: 'tool-22',
      name: 'read',
      arguments: {
        path: '/home/folder/file',
        offset: 10,
        limit: 1,
      },
      result: JSON.stringify({
        content: [{ type: 'text', text: 'hello world' }],
      }),
      error: '',
    }),
  },

  {
    messageIndex: 2,
    sessionId: 'session',
    createdAt: 10,
    role: Role.assistant,
    isToolResult: false,
    content: 'The file contains a hello world message',
  },
];

describe('Typesafe extraction of tool result and messages', () => {
  test('extracts bash tool results whose result is a serialized shell response', () => {
    const result = cleanMessageHistroy(bashInput);
    expect(result).toEqual([
      {
        role: Role.tool,
        content: 'shell:  | command : printf \'{"status":"ok"}\' | timeout : 120000 \n',
        createdAt: 1,
      },
    ]);
  });
  test('extract read tool result whose result is a ToolResult type JSON', () => {
    const result = cleanMessageHistroy(multipleMessages.slice(1, 2));
    expect(result).toEqual([
      {
        role: Role.tool,
        content: 'read:  | path : /home/folder/file | offset : 10 | limit : 1 \n',
        createdAt: 3,
      },
    ]);
  });
  test('extract thought or answer whose results are simple string', () => {
    const result = cleanMessageHistroy(multipleMessages.slice(0, 1));
    expect(result).toEqual([
      {
        role: Role.thought,
        content: 'The user wants to read file in the current working directory.',
        createdAt: 1,
      },
    ]);
  });
  test('expect an empty array when passed empty array', () => {
    const result = cleanMessageHistroy([]);
    expect(result).toEqual([]);
  });
});
