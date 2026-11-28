// src/docs/markdown.ts
// The inline grammar used by every `text` field in a doc page, plus the
// Markdown serialiser behind the "Copy page" button.
//
// The grammar is intentionally three constructs deep — `code`, **strong** and
// [label](href) — because that is all the documentation needs, and a parser
// that small can be read and trusted. Anything it does not recognise is plain
// text, so a stray backtick or bracket renders literally instead of
// disappearing.

import type { Block, DocPage } from './types';

/** One run of inline content. */
export type Inline =
  | { kind: 'text'; value: string }
  | { kind: 'code'; value: string }
  | { kind: 'strong'; value: string }
  | { kind: 'link'; label: string; href: string };

/**
 * Matches the three inline constructs. Every group inside an alternative is
 * non-capturing so the four capture groups keep stable indices.
 */
const INLINE_PATTERN = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Split one inline string into runs. */
export function parseInline(text: string): Inline[] {
  const runs: Inline[] = [];
  let cursor = 0;
  INLINE_PATTERN.lastIndex = 0;
  for (let match = INLINE_PATTERN.exec(text); match !== null; match = INLINE_PATTERN.exec(text)) {
    if (match.index > cursor) {
      runs.push({ kind: 'text', value: text.slice(cursor, match.index) });
    }
    // `RegExpExecArray` is typed as `string[]`, so the optional capture groups
    // are widened explicitly: an unmatched alternative really is `undefined`.
    const raw = match[0];
    const [code, strong, label, href]: (string | undefined)[] = [
      match[1],
      match[2],
      match[3],
      match[4],
    ];
    if (code !== undefined) {
      runs.push({ kind: 'code', value: code });
    } else if (strong !== undefined) {
      runs.push({ kind: 'strong', value: strong });
    } else if (label !== undefined && href !== undefined) {
      runs.push({ kind: 'link', label, href });
    } else {
      // Unreachable while the pattern above is the only source of matches;
      // kept so a future alternative can never silently drop text.
      runs.push({ kind: 'text', value: raw });
    }
    cursor = match.index + raw.length;
  }
  if (cursor < text.length) {
    runs.push({ kind: 'text', value: text.slice(cursor) });
  }
  return runs;
}

/** Plain-text projection of an inline string, for the search index. */
export function inlineToText(text: string): string {
  return parseInline(text)
    .map((run) => {
      switch (run.kind) {
        case 'code':
        case 'strong':
          return run.value;
        case 'link':
          return run.label;
        default:
          return run.value;
      }
    })
    .join('');
}

/** Turn a heading into a stable anchor id. */
export function headingId(text: string): string {
  return inlineToText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/** Serialise one block back to Markdown. */
function blockToMarkdown(block: Block): string {
  switch (block.kind) {
    case 'p':
      return block.text;
    case 'heading':
      return `${'#'.repeat(block.level)} ${block.text}`;
    case 'code':
      return ['```' + block.lang, block.code, '```'].join('\n');
    case 'list':
      return block.items
        .map((item, index) => (block.ordered ? `${index + 1}. ${item}` : `- ${item}`))
        .join('\n');
    case 'table': {
      const head = `| ${block.head.join(' | ')} |`;
      const rule = `| ${block.head.map(() => '---').join(' | ')} |`;
      const rows = block.rows.map((row) => `| ${row.join(' | ')} |`);
      return [head, rule, ...rows].join('\n');
    }
    case 'callout': {
      const title = block.title ? `**${block.title}** — ` : '';
      return [`> ${title}${block.text}`].join('\n');
    }
    case 'rule':
      return '---';
  }
}

/**
 * Render a whole page as Markdown, so "Copy page" puts the same text a
 * contributor would find in a `.md` file on the clipboard.
 */
export function pageToMarkdown(page: DocPage): string {
  const parts = [`# ${page.title}`, `_${page.subtitle}_`];
  for (const block of page.blocks) {
    parts.push(blockToMarkdown(block));
  }
  return `${parts.join('\n\n')}\n`;
}
