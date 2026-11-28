// src/docs/types.ts
// The shape of a documentation page.
//
// Content is authored as typed data rather than Markdown strings on purpose:
// the web package has no Markdown toolchain, and a typed block model gives the
// renderer, the search index and the "Copy page" button one shared source
// without pulling in a parser. Every page is a plain object, so adding a page
// is adding a file — never editing a JSX blob.

/** Languages the code-block highlighter knows about. */
export type CodeLang = 'bash' | 'ts' | 'tsx' | 'json' | 'sql' | 'text';

/**
 * One block of page content.
 *
 * `text` fields carry a deliberately small inline grammar — see
 * `parseInline` in src/docs/markdown.ts — supporting `` `code` ``,
 * `**strong**` and `[label](href)` and nothing else.
 */
export type Block =
  | { kind: 'p'; text: string }
  | { kind: 'heading'; level: 2 | 3; text: string }
  | { kind: 'code'; lang: CodeLang; code: string; title?: string }
  | { kind: 'list'; ordered?: boolean; items: string[] }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'callout'; variant: 'note' | 'warning'; title?: string; text: string }
  | { kind: 'rule' };

/** One documentation page. */
export interface DocPage {
  /** Route segment, unique across the site. May contain a `/` for nesting. */
  slug: string;
  /** Sidebar group this page belongs to. */
  group: string;
  /** Small accent-coloured label printed above the title. */
  category: string;
  /** Page title, rendered as the H1 and used as the document title. */
  title: string;
  /** One-line muted subtitle under the title. */
  subtitle: string;
  blocks: Block[];
}

/** A sidebar group: a bold title and the pages listed under it. */
export interface DocGroup {
  /** Group title, shown bold in the sidebar. */
  title: string;
  /** Which top-level tab this group belongs to. */
  tab: DocTab;
  /** Page slugs, in reading order. */
  pages: string[];
}

/** The top-level tab row above the sidebar. */
export type DocTab = 'documentation' | 'reference';

/** A heading extracted from a page, for the right rail's table of contents. */
export interface TocEntry {
  /** Anchor id, derived from the heading text. */
  id: string;
  text: string;
  level: 2 | 3;
}
