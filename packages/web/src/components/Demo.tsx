import { content } from '@/content';

export default function Demo() {
  const { demo } = content;
  return (
    <section className="mx-auto w-full max-w-5xl px-5 py-10 sm:py-12">
      <div className="text-center mb-8">
        <h2 className="mt-5 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          {demo.title}
        </h2>
      </div>
      <div className="mx-auto max-w-[1200px] rounded-xl border border-border overflow-hidden shadow-xl">
        <video
          src={demo.video.src}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-auto block"
        />
      </div>
    </section>
  );
}
