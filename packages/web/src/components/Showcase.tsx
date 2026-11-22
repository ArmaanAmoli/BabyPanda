import { content } from '@/content';

export default function Showcase() {
  const { showcase } = content;
  return (
    <section id="showcase" className="mx-auto w-full max-w-5xl px-5 py-10 sm:py-12">
      <div className="text-center mb-10">
        <h2 className="mt-5 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          {showcase.title}
        </h2>
      </div>
      <div className="flex flex-col gap-10">
        {showcase.items.map((item) => (
          <div key={item.src} className="flex flex-col items-center">
            <img
              src={item.src}
              alt={item.alt}
              className="w-full max-w-[1100px] h-auto rounded-xl border border-ink/15 shadow-xl"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
