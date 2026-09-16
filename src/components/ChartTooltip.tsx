"use client";
export function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string; dashed?: boolean }[] }) {
  return (
    <div className="card min-w-40 px-3 py-2 text-xs shadow-none" style={{ borderColor: "var(--border-strong)" }}>
      <div className="mb-1.5 font-normal text-muted">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-2 text-muted">
            {r.color && <span aria-hidden className="inline-block h-0.5 w-3" style={{ background: r.dashed ? `repeating-linear-gradient(90deg, ${r.color} 0 3px, transparent 3px 5px)` : r.color }} />}
            {r.label}
          </span>
          <span className="font-normal text-ink">{r.value}</span>
        </div>
      ))}
    </div>
  );
}
