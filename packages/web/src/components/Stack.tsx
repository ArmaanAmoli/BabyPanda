import { content } from '@/content';

export default function Stack() {
  return (
    <section id="stack" className="mx-auto w-full max-w-5xl px-5 py-14 sm:py-20">
      <ul className="flex flex-wrap gap-2">
        {content.stack.map((item) => (
          <li
            key={item}
            className="rounded-sm border border-ink/15 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/70"
          >
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
