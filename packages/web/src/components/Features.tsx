import { content } from '@/content';

export default function Features() {
  return (
    <section id="features" className="mx-auto w-full max-w-5xl px-5 py-14 sm:py-20">
      <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {content.features.map((feature, i) => (
          <li
            key={feature.title}
            className="rounded-md border border-ink/10 bg-ink/[0.03] p-5 transition-colors hover:border-ink/25"
          >
            <span aria-hidden="true" className="font-mono text-[11px] text-accent">
              {String(i + 1).padStart(2, '0')}
            </span>
            <h3 className="mt-3 text-base font-semibold tracking-tight text-ink">
              {feature.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-ink/60">{feature.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
