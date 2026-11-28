// src/docs/components/Blocks.tsx
// Turns a page's block list into the centre column: prose, headings, lists,
// tables, code and callouts.

import { headingId } from '../markdown';
import type { Block } from '../types';
import { Inline } from './Inline';
import { CodeBlock } from './CodeBlock';

/** One H2 or H3, with the anchor the right rail links to. */
function Heading({ level, text }: { level: 2 | 3; text: string }) {
  const id = headingId(text);
  const shared = 'scroll-mt-24 font-bold tracking-tight text-ink';
  if (level === 2) {
    return (
      <h2 id={id} className={`mt-12 mb-4 text-2xl ${shared}`}>
        <Inline text={text} />
      </h2>
    );
  }
  return (
    <h3 id={id} className={`mt-8 mb-3 text-lg ${shared}`}>
      <Inline text={text} />
    </h3>
  );
}

/** A table with a hairline under each row and a muted header. */
function DataTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="docs-scroll my-6 overflow-x-auto rounded-lg border border-rule">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-rule">
            {head.map((cell, index) => (
              <th
                key={index}
                scope="col"
                className="px-4 py-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint"
              >
                <Inline text={cell} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-rule last:border-0">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-3 align-top text-ink/85">
                  <Inline text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A Note or Warning callout, drawn as a tinted plane with an accent rule. */
function Callout({
  variant,
  title,
  text,
}: {
  variant: 'note' | 'warning';
  title?: string;
  text: string;
}) {
  const warning = variant === 'warning';
  return (
    <aside
      className={`my-6 rounded-lg border bg-surface px-4 py-3.5 ${
        warning ? 'border-accent/35' : 'border-rule'
      }`}
    >
      <p
        className={`mb-1 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] ${
          warning ? 'text-accent' : 'text-faint'
        }`}
      >
        {title ?? (warning ? 'Warning' : 'Note')}
      </p>
      <p className="text-sm leading-7 text-ink/85">
        <Inline text={text} />
      </p>
    </aside>
  );
}

/** Render one block. */
function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case 'p':
      return (
        <p className="my-4 text-[15px] leading-8 text-ink/85">
          <Inline text={block.text} />
        </p>
      );
    case 'heading':
      return <Heading level={block.level} text={block.text} />;
    case 'code':
      return <CodeBlock lang={block.lang} code={block.code} title={block.title} />;
    case 'list':
      return block.ordered ? (
        <ol className="my-4 list-decimal space-y-2 pl-6 text-[15px] leading-8 text-ink/85 marker:text-faint">
          {block.items.map((item, index) => (
            <li key={index}>
              <Inline text={item} />
            </li>
          ))}
        </ol>
      ) : (
        <ul className="my-4 list-disc space-y-2 pl-6 text-[15px] leading-8 text-ink/85 marker:text-faint">
          {block.items.map((item, index) => (
            <li key={index}>
              <Inline text={item} />
            </li>
          ))}
        </ul>
      );
    case 'table':
      return <DataTable head={block.head} rows={block.rows} />;
    case 'callout':
      return <Callout variant={block.variant} title={block.title} text={block.text} />;
    case 'rule':
      return <hr className="my-10 border-0 border-t border-rule" />;
  }
}

/** Render a whole page body. */
export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} />
      ))}
    </>
  );
}
