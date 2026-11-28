// src/docs/components/Inline.tsx
// Renders one inline string: `code`, **strong** and [label](href).

import { parseInline } from '../markdown';

/** Render an inline string as React nodes. */
export function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((run, index) => {
        switch (run.kind) {
          case 'code':
            return (
              <code
                key={index}
                className="rounded-sm border border-rule bg-surface px-1.5 py-0.5 font-mono text-[0.86em] text-ink"
              >
                {run.value}
              </code>
            );
          case 'strong':
            return (
              <strong key={index} className="font-semibold text-ink">
                {run.value}
              </strong>
            );
          case 'link':
            return (
              <a key={index} href={run.href}>
                {run.label}
              </a>
            );
          default:
            return <span key={index}>{run.value}</span>;
        }
      })}
    </>
  );
}
