import { describe, expect, test } from 'bun:test';
import { Role, type MessagesArray } from '@baby-panda/types';
import { toProviderMessages } from './client';

const IMAGE = 'data:image/png;base64,AAA=';

describe('toProviderMessages', () => {
  test('text-only messages pass through unchanged', () => {
    const messages: MessagesArray = [
      { role: Role.system, content: 'sys' },
      { role: Role.user, content: 'hello' },
    ];
    expect(toProviderMessages(messages, true, 'm')).toEqual(messages);
  });

  test('image parts become OpenAI image_url parts for multimodal models', () => {
    const messages: MessagesArray = [
      {
        role: Role.user,
        content: [
          { type: 'text', text: 'look [image: image-1.png]' },
          { type: 'image', image: IMAGE },
        ],
      },
    ];
    expect(toProviderMessages(messages, true, 'm')).toEqual([
      {
        role: Role.user,
        content: [
          { type: 'text', text: 'look [image: image-1.png]' },
          { type: 'image_url', image_url: { url: IMAGE } },
        ],
      },
    ]);
  });

  test('a non-multimodal model rejects images with a readable error', () => {
    const messages: MessagesArray = [
      { role: Role.user, content: [{ type: 'image', image: IMAGE }] },
    ];
    expect(() => toProviderMessages(messages, false, 'text-only-model')).toThrow(
      /text-only-model does not support image input/,
    );
  });

  test('non-user messages are never rewritten, even with array content', () => {
    const messages = [
      { role: Role.system, content: 'sys' },
      { role: Role.user, content: [{ type: 'image', image: IMAGE }] },
    ] as MessagesArray;
    const converted = toProviderMessages(messages, true, 'm') as unknown[];
    expect(converted[0]).toEqual({ role: Role.system, content: 'sys' });
  });
});
