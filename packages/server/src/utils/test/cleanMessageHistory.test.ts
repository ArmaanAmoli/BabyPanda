import { expect, test } from 'bun:test';
import { cleanMessageHistroy } from '../cleanMessageHistory';
import { getMessages } from '@baby-panda/db';
import { Role } from '@baby-panda/types';

test('Typesafe extraction of tool result and messages', async () => {
  const messageHistory = await getMessages('acc0899b-9876-4de2-8ac4-78b3ad4201be');
  expect(() => cleanMessageHistroy(messageHistory)).not.toThrowError();
});

test('extracts bash tool results whose result is a serialized shell response', () => {
  const result = cleanMessageHistroy([
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
  ]);

  expect(result).toEqual([
    {
      role: Role.tool,
      content: 'shell:  | command : printf \'{"status":"ok"}\' | timeout : 120000 \n',
      createdAt: 1,
    },
  ]);
});
