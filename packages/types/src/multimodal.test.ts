import { describe, expect, test } from 'bun:test';
import {
  MultiModalContentSchema,
  Role,
  UserMessageSchema,
  WsEventMessageSchema,
  WsEventTypes,
} from './index';

const PARTS = [
  { type: 'text', text: 'look at [image: image-1.png]' },
  { type: 'image', image: 'data:image/png;base64,AAA=' },
  { type: 'image', image: 'data:image/png;base64,BBB=' },
];

describe('MultiModalContentSchema', () => {
  test('accepts a text part followed by several image parts', () => {
    expect(MultiModalContentSchema.parse(PARTS)).toEqual(PARTS);
  });

  test('rejects parts with an unknown type', () => {
    expect(() => MultiModalContentSchema.parse([{ type: 'video', url: 'x' }])).toThrow();
  });
});

describe('UserMessageSchema', () => {
  test('accepts both string and parts-array content', () => {
    expect(UserMessageSchema.parse({ role: Role.user, content: 'plain' })).toEqual({
      role: Role.user,
      content: 'plain',
    });
    expect(UserMessageSchema.parse({ role: Role.user, content: PARTS })).toEqual({
      role: Role.user,
      content: PARTS,
    });
  });
});

describe('WsEventMessageSchema', () => {
  test('a user message may carry parts-array content', () => {
    const parsed = WsEventMessageSchema.parse({
      eventType: WsEventTypes.message,
      role: Role.user,
      content: PARTS,
    });
    expect(parsed).toEqual({
      eventType: WsEventTypes.message,
      role: Role.user,
      content: PARTS,
    });
  });

  test('a plain-text user message still parses', () => {
    expect(
      WsEventMessageSchema.parse({
        eventType: WsEventTypes.message,
        role: Role.user,
        content: 'hello',
      }),
    ).toEqual({
      eventType: WsEventTypes.message,
      role: Role.user,
      content: 'hello',
    });
  });
});
