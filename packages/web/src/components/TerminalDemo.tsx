import { content } from '@/content';
import type { TerminalLineKind } from '@/content';

// Glyph prefixes per line kind (UI chrome, not copy).
const PREFIX: Record<TerminalLineKind, string> = {
  user: '❯',
  thought: '·',
  tool: '→',
  answer: '✓',
};

const KIND_CLASS: Record<TerminalLineKind, string> = {
  user: 'text-ink',
  thought: 'text-ink/40 italic',
  tool: 'text-accent',
  answer: 'text-ink/90',
};

export default function TerminalDemo() {
  const { terminalDemo } = content;
  return (
    <section id="demo" className="mx-auto w-full max-w-5xl px-5 py-14 sm:py-20">
      <div className="overflow-hidden rounded-md border border-ink/15 bg-ink/[0.03]">
        <div className="flex items-center gap-2 border-b border-ink/10 px-4 py-2.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-ink/20" />
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-ink/20" />
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-ink/20" />
          <span className="ml-2 truncate font-mono text-[11px] text-ink/40">
            {terminalDemo.title}
          </span>
        </div>
        <div className="overflow-x-auto px-4 py-4 font-mono text-[13px] leading-7 sm:px-5 sm:text-sm">
          {terminalDemo.lines.map((line, i) => (
            <p
              key={i}
              className={`td-line flex gap-3 ${KIND_CLASS[line.kind]}`}
              style={{ animationDelay: `${i * 160}ms` }}
            >
              <span aria-hidden="true" className="w-4 shrink-0 select-none text-right opacity-70">
                {PREFIX[line.kind]}
              </span>
              <span className="whitespace-pre-wrap break-words">{line.text}</span>
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
