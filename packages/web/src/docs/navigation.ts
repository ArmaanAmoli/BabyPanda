// src/docs/navigation.ts
// The documentation site's information architecture: which groups exist, which
// tab each belongs to, and the reading order inside a group.
//
// This file is the only place the sidebar, the tab row, the previous/next
// links and the search index agree on structure. Adding a page means adding
// its file under src/docs/pages and listing its slug here.

import type { DocGroup, DocTab } from './types';

export const DOC_GROUPS: DocGroup[] = [
  {
    title: 'Get started',
    tab: 'documentation',
    pages: ['overview', 'install', 'quickstart'],
  },
  {
    title: 'CLI',
    tab: 'reference',
    pages: ['cli/commands', 'cli/interface'],
  },
  {
    title: 'Concepts',
    tab: 'documentation',
    pages: ['sessions', 'providers', 'tools-and-mcp', 'memory', 'context-management'],
  },
  {
    title: 'Architecture',
    tab: 'documentation',
    pages: ['architecture', 'logging-and-configuration'],
  },
  {
    title: 'Project',
    tab: 'documentation',
    pages: ['contributing', 'license'],
  },
];

/** The top-level tabs, in display order. */
export const DOC_TABS: { id: DocTab; label: string }[] = [
  { id: 'documentation', label: 'Documentation' },
  { id: 'reference', label: 'Reference' },
];

/** Every page slug, flattened in reading order. Drives previous/next links. */
export const DOC_ORDER: string[] = DOC_GROUPS.flatMap((group) => group.pages);

/** The tab a page belongs to, derived from its group. */
export function tabForSlug(slug: string): DocTab {
  const group = DOC_GROUPS.find((candidate) => candidate.pages.includes(slug));
  return group?.tab ?? 'documentation';
}

/** The first page of a tab, used when a tab is clicked from another tab. */
export function firstPageOfTab(tab: DocTab): string {
  const group = DOC_GROUPS.find((candidate) => candidate.tab === tab);
  return group?.pages[0] ?? DOC_ORDER[0];
}
