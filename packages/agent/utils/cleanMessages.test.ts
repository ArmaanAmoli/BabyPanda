import { describe, expect, test } from 'bun:test';
import { Role, type MessagesArray, type ToolResultRecord } from '@baby-panda/types';
import { toApiMessages } from './cleanMessages';

describe('toApiMessages', () => {
  test('strips CLI-only fields from a live tool result record', () => {
    // This is the shape persistAndEmitResult pushes into the live message
    // array: the full ToolResultRecord, not the bare ToolMessage.
    const record: ToolResultRecord = {
      role: Role.tool,
      tool_call_id: 'call_abc123',
      content: '{"id":"call_abc123","name":"edit","result":{"content":[]}}',
      success: true,
      before: 'entire file content before the edit',
      stats: { added: 3, removed: 1 },
      pages: [{ url: 'https://example.com', success: true }],
    };
    const messages: MessagesArray = [record];

    const api = toApiMessages(messages);

    expect(api[0]).toEqual({
      role: Role.tool,
      tool_call_id: 'call_abc123',
      content: '{"id":"call_abc123","name":"edit","result":{"content":[]}}',
    });
    expect('success' in api[0]!).toBeFalse();
    expect('before' in api[0]!).toBeFalse();
    expect('stats' in api[0]!).toBeFalse();
    expect('pages' in api[0]!).toBeFalse();
  });

  test('strips the error field from a failed tool result record', () => {
    const record: ToolResultRecord = {
      role: Role.tool,
      tool_call_id: 'call_denied',
      content: '[PERMISSION DENIED] Command execution denied by user.',
      success: false,
      error: '[PERMISSION DENIED] Command execution denied by user.',
    };

    const api = toApiMessages([record]);

    expect(api[0]).toEqual({
      role: Role.tool,
      tool_call_id: 'call_denied',
      content: '[PERMISSION DENIED] Command execution denied by user.',
    });
  });

  test('strips the skill name from a user message', () => {
    const messages: MessagesArray = [
      {
        role: Role.user,
        name: 'my-skill',
        content: '<skill>do it</skill>',
      } as MessagesArray[number],
    ];

    const api = toApiMessages(messages);

    expect(api[0]).toEqual({ role: Role.user, content: '<skill>do it</skill>' });
  });

  test('keeps assistant and system messages intact', () => {
    const messages: MessagesArray = [
      { role: Role.system, content: 'system prompt' },
      {
        role: Role.assistant,
        content: '',
        reasoning_content: 'thinking...',
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: { name: 'list', arguments: '{"path":"/tmp"}' },
          },
        ],
      },
    ];

    const api = toApiMessages(messages);

    expect(api).toEqual(messages);
  });

  test('does not mutate the input array', () => {
    const record: ToolResultRecord = {
      role: Role.tool,
      tool_call_id: 'call_1',
      content: 'ok',
      success: true,
    };
    const messages: MessagesArray = [record];

    toApiMessages(messages);

    expect(messages[0]!).toBe(record);
    expect('success' in messages[0]!).toBeTrue();
  });
});
