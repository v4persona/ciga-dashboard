export function Section({ id, title, description, aside, children }: { id: string; title: string; description?: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28">
      <div className="rule mb-8" />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="index-mark font-condensed text-[28px] leading-none text-ink">{title}</h2>
          {description && <p className="mt-2 max-w-[62ch] text-sm text-muted">{description}</p>}
        </div>
        {aside && <div className="text-sm text-muted">{aside}</div>}
      </div>
      {children}
    </section>
  );
}
