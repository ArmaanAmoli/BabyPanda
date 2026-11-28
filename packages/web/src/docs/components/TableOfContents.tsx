// src/docs/components/TableOfContents.tsx
// The right rail: "On this page", generated from the page's H2/H3 headings,
// sticky, with the current section highlighted by scroll-spy.

import { useScrollSpy } from '../hooks';
import type { TocEntry } from '../types';

export interface TableOfContentsProps {
  entries: TocEntry[];
}

export function TableOfContents({ entries }: TableOfContentsProps) {
  const ids = entries.map((entry) => entry.id);
  const active = useScrollSpy(ids);

  if (entries.length === 0) return null;

  return (
    <aside className="docs-scroll sticky top-[105px] hidden h-[calc(100vh-105px)] overflow-y-auto xl:block">
      <nav aria-labelledby="toc-heading" className="py-6 pl-2">
        <h2
          id="toc-heading"
          className="mb-3 flex items-center gap-2 text-[13px] font-bold tracking-tight text-ink"
        >
          <span aria-hidden="true" className="text-faint">
            ☰
          </span>
          On this page
        </h2>
        <ul className="space-y-1.5 border-l border-rule">
          {entries.map((entry) => {
            const current = entry.id === active;
            return (
              <li key={entry.id}>
                <a
                  href={`#${entry.id}`}
                  aria-current={current ? 'location' : undefined}
                  className={`relative -ml-px block border-l py-1 text-[13px] leading-5 transition-colors ${
                    entry.level === 3 ? 'pl-6' : 'pl-3'
                  } ${
                    current
                      ? 'docs-toc-active border-transparent font-medium text-accent'
                      : 'border-transparent text-muted hover:text-ink'
                  }`}
                >
                  {entry.text}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
