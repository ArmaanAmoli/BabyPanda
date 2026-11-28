// src/docs/index.ts
// The documentation site's entry point for content: every page, the lookup by
// slug, the table of contents for a page, and the in-memory search index.
//
// Nothing here reads the network. The whole site is a static bundle, which is
// what lets it be served from a GitHub Pages sub-path with no server-side
// routing at all.

import overview from './pages/overview';
import install from './pages/install';
import quickstart from './pages/quickstart';
import cliCommands from './pages/cli-commands';
import cliInterface from './pages/cli-interface';
import cliSlashCommands from './pages/cli-slash-commands';
import cliShortcuts from './pages/cli-shortcuts';
import sessions from './pages/sessions';
import providers from './pages/providers';
import toolsAndMcp from './pages/tools-and-mcp';
import memory from './pages/memory';
import contextManagement from './pages/context-management';
import architecture from './pages/architecture';
import loggingAndConfiguration from './pages/logging-and-configuration';
import contributing from './pages/contributing';
import license from './pages/license';
import { DOC_GROUPS, DOC_ORDER } from './navigation';
import { headingId, inlineToText } from './markdown';
import type { DocPage, TocEntry } from './types';

export const DOC_PAGES: DocPage[] = [
  overview,
  install,
  quickstart,
  cliCommands,
  cliInterface,
  cliSlashCommands,
  cliShortcuts,
  sessions,
  providers,
  toolsAndMcp,
  memory,
  contextManagement,
  architecture,
  loggingAndConfiguration,
  contributing,
  license,
];

/** Every page, keyed by slug. */
const BY_SLUG = new Map(DOC_PAGES.map((page) => [page.slug, page] as const));

/** Look up a page by slug. */
export function getPage(slug: string): DocPage | undefined {
  return BY_SLUG.get(slug);
}

/** The page a fresh visitor lands on. */
export const DOC_HOME_SLUG = DOC_ORDER[0];

/** The headings of a page, in document order, for the right rail. */
export function tableOfContents(page: DocPage): TocEntry[] {
  const entries: TocEntry[] = [];
  for (const block of page.blocks) {
    if (block.kind !== 'heading') continue;
    entries.push({ id: headingId(block.text), text: block.text, level: block.level });
  }
  return entries;
}

/** The previous and next pages, for the footer links. */
export function neighbours(slug: string): { previous?: DocPage; next?: DocPage } {
  const index = DOC_ORDER.indexOf(slug);
  if (index === -1) return {};
  const previous = DOC_ORDER[index - 1];
  const next = DOC_ORDER[index + 1];
  return {
    previous: previous === undefined ? undefined : BY_SLUG.get(previous),
    next: next === undefined ? undefined : BY_SLUG.get(next),
  };
}

/** The sidebar group a page belongs to. */
export function groupOf(slug: string): string | undefined {
  return DOC_GROUPS.find((group) => group.pages.includes(slug))?.title;
}

/** One searchable unit: a page title, one of its headings, or a run of prose. */
export interface SearchEntry {
  slug: string;
  category: string;
  pageTitle: string;
  /** The heading this hit sits under, or the page title for a title hit. */
  section: string;
  /** Anchor to scroll to; empty for a page-level hit. */
  anchor: string;
  text: string;
  /** Where the hit came from, used for ranking. */
  weight: 0 | 1 | 2;
}

/**
 * Build the search index once, at module load.
 *
 * Weighting is deliberately simple: a title hit outranks a heading hit, which
 * outranks a body hit. There is no tokeniser or inverted index — the corpus is
 * fourteen pages, so a linear scan over a few hundred strings is instant.
 */
function buildSearchIndex(): SearchEntry[] {
  const entries: SearchEntry[] = [];
  for (const page of DOC_PAGES) {
    entries.push({
      slug: page.slug,
      category: page.category,
      pageTitle: page.title,
      section: page.title,
      anchor: '',
      text: `${page.title} — ${inlineToText(page.subtitle)}`,
      weight: 0,
    });

    let section = page.title;
    for (const block of page.blocks) {
      if (block.kind === 'heading') {
        section = block.text;
        entries.push({
          slug: page.slug,
          category: page.category,
          pageTitle: page.title,
          section,
          anchor: headingId(block.text),
          text: block.text,
          weight: 1,
        });
        continue;
      }
      const prose =
        block.kind === 'p'
          ? block.text
          : block.kind === 'callout'
            ? `${block.title ?? ''} ${block.text}`
            : block.kind === 'list'
              ? block.items.join(' ')
              : block.kind === 'table'
                ? [...block.head, ...block.rows.flat()].join(' ')
                : block.kind === 'code'
                  ? block.code
                  : '';
      if (prose.trim() === '') continue;
      entries.push({
        slug: page.slug,
        category: page.category,
        pageTitle: page.title,
        section,
        anchor: '',
        text: inlineToText(prose),
        weight: 2,
      });
    }
  }
  return entries;
}

export const SEARCH_INDEX: SearchEntry[] = buildSearchIndex();

/** A search hit, with the entry and a score for ordering. */
export interface SearchHit {
  entry: SearchEntry;
  score: number;
}

/**
 * Score every entry against a query.
 *
 * A hit needs every whitespace-separated term to appear somewhere in the
 * entry, so "compact trigger" finds the context page but "compact zebra" does
 * not. Earlier terms weigh slightly more, and a lower weight (a title or a
 * heading) always beats a body hit.
 */
export function search(query: string, limit = 12): SearchHit[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term !== '');
  if (terms.length === 0) return [];

  const hits: SearchHit[] = [];
  for (const entry of SEARCH_INDEX) {
    const haystack = entry.text.toLowerCase();
    let matchedAll = true;
    let score = 0;
    for (let index = 0; index < terms.length; index += 1) {
      const term = terms[index];
      const at = haystack.indexOf(term);
      if (at === -1) {
        matchedAll = false;
        break;
      }
      // Earlier terms and earlier positions score higher.
      score += (terms.length - index) * 10 - Math.min(at, 40);
    }
    if (!matchedAll) continue;
    hits.push({ entry, score: score - entry.weight * 25 });
  }

  hits.sort((a, b) => b.score - a.score || a.entry.slug.localeCompare(b.entry.slug));
  return hits.slice(0, limit);
}
