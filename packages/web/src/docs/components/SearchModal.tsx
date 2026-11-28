// src/docs/components/SearchModal.tsx
// The Ctrl/Cmd+K palette: a client-side search over page titles, headings and
// body text, driven by the in-memory index in src/docs/index.ts.

import { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, Search, X } from 'lucide-react';
import { search } from '../index';

export interface SearchModalProps {
  onClose: () => void;
  onNavigate: (slug: string, anchor: string) => void;
}

/**
 * The search palette.
 *
 * The parent mounts this only while it is open, so every open starts from an
 * empty query without an effect having to reset it.
 */
export function SearchModal({ onClose, onNavigate }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const hits = useMemo(() => search(query), [query]);

  // Focus once, after the dialog has painted, so the caret lands in the field.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const commit = (index: number) => {
    const hit = hits[index];
    if (!hit) return;
    onNavigate(hit.entry.slug, hit.entry.anchor);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
      <div
        className="absolute inset-0 bg-bg/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search the documentation"
        className="relative w-full max-w-xl overflow-hidden rounded-xl border border-border bg-bg shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-rule px-4">
          <Search size={16} className="shrink-0 text-faint" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCursor(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
              } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                setCursor((current) => Math.min(current + 1, hits.length - 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setCursor((current) => Math.max(current - 1, 0));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                commit(cursor);
              }
            }}
            type="text"
            placeholder="Search pages, headings and content…"
            aria-label="Search query"
            className="w-full bg-transparent py-3.5 text-[15px] text-ink outline-none placeholder:text-faint"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="shrink-0 rounded-sm p-1 text-faint transition-colors hover:text-ink"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        {query.trim() === '' ? (
          <p className="px-4 py-8 text-center text-[13px] text-faint">
            Type to search. Every page title, heading and paragraph is indexed.
          </p>
        ) : hits.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-faint">Nothing matches “{query}”.</p>
        ) : (
          <ul className="docs-scroll max-h-[50vh] overflow-y-auto py-2">
            {hits.map((hit, index) => (
              <li key={`${hit.entry.slug}-${hit.entry.anchor}-${index}`}>
                <button
                  type="button"
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => commit(index)}
                  className={`flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors ${
                    index === cursor ? 'bg-surface-strong' : ''
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink">
                      {hit.entry.pageTitle}
                    </span>
                    <span className="block truncate text-[12px] text-muted">
                      {hit.entry.section}
                      {hit.entry.anchor === '' ? '' : ' · '}
                      {hit.entry.text.slice(0, 90)}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
                    {hit.entry.category}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between border-t border-rule px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
          <span>↑↓ to move · Enter to open</span>
          <span className="flex items-center gap-1">
            Esc to close
            <CornerDownLeft size={11} aria-hidden="true" />
          </span>
        </div>
      </div>
    </div>
  );
}
