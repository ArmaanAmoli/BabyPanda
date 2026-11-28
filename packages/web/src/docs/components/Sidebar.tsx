// src/docs/components/Sidebar.tsx
// The left column: grouped navigation, sticky and independently scrollable,
// with a "back to BabyPanda" link in its footer.
//
// The same component is used twice — as the persistent column above the `lg`
// breakpoint, and as the drawer below it — so the two can never drift.

import { ArrowLeft, X } from 'lucide-react';
import { DOC_GROUPS } from '../navigation';
import { getPage } from '../index';
import { siteRoot } from '@/theme';
import type { DocGroup } from '../types';

export interface SidebarProps {
  /** The page currently being read. */
  activeSlug: string;
  onNavigate: (slug: string) => void;
  /** Which groups to show; the tab row filters this. */
  tab: 'documentation' | 'reference';
  /** Rendered as a drawer with a close button instead of a static column. */
  variant?: 'column' | 'drawer';
  onClose?: () => void;
}

function GroupList({
  groups,
  activeSlug,
  onNavigate,
}: {
  groups: DocGroup[];
  activeSlug: string;
  onNavigate: (slug: string) => void;
}) {
  return (
    <div className="space-y-7">
      {groups.map((group) => (
        <section key={group.title}>
          <h2 className="mb-2 px-3 text-[13px] font-bold tracking-tight text-ink">{group.title}</h2>
          <ul>
            {group.pages.map((slug) => {
              const active = slug === activeSlug;
              return (
                <li key={slug}>
                  <a
                    href={`#/${slug}`}
                    onClick={(event) => {
                      event.preventDefault();
                      onNavigate(slug);
                    }}
                    aria-current={active ? 'page' : undefined}
                    className={`block rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                      active
                        ? 'font-medium text-accent'
                        : 'text-muted hover:bg-surface hover:text-ink'
                    }`}
                  >
                    {getPage(slug)?.title ?? slug}
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function Sidebar({
  activeSlug,
  onNavigate,
  tab,
  variant = 'column',
  onClose,
}: SidebarProps) {
  const groups = DOC_GROUPS.filter((group) => group.tab === tab);

  const footer = (
    <a
      href={siteRoot()}
      className="flex items-center gap-2 border-t border-rule px-3 py-3 text-[13px] text-muted transition-colors hover:text-ink"
    >
      <ArrowLeft size={14} aria-hidden="true" />
      Back to BabyPanda
    </a>
  );

  if (variant === 'drawer') {
    return (
      <div className="fixed inset-0 z-40 lg:hidden">
        <div
          className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Documentation navigation"
          className="docs-scroll absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-rule bg-bg"
        >
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-[13px] font-bold text-ink">Documentation</span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close navigation"
              className="rounded-sm p-1.5 text-muted transition-colors hover:text-ink"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <nav className="flex-1 px-3 pb-4">
            <GroupList groups={groups} activeSlug={activeSlug} onNavigate={onNavigate} />
          </nav>
          {footer}
        </div>
      </div>
    );
  }

  return (
    <aside className="docs-scroll sticky top-[105px] hidden h-[calc(100vh-105px)] shrink-0 overflow-y-auto border-r border-rule lg:block">
      <nav className="px-3 py-6">
        <GroupList groups={groups} activeSlug={activeSlug} onNavigate={onNavigate} />
      </nav>
      {footer}
    </aside>
  );
}
