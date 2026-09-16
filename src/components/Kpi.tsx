import { fmtPct } from "@/lib/format";

export function Delta({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null) return <span className="text-xs text-subtle">sem base anterior</span>;
  const up = value >= 0;
  const good = invert ? !up : up;
  const color = Math.abs(value) < 0.005 ? "text-muted" : good ? "text-good" : "text-bad";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-normal ${color}`}>
      <span aria-hidden>{up ? "▲" : "▼"}</span>
      {fmtPct(Math.abs(value), 0)}
      <span className="text-subtle">vs. anterior</span>
    </span>
  );
}

export function Kpi({ label, value, sub, delta, invert, accent = false, size = "md" }: {
  label: string; value: string; sub?: React.ReactNode; delta?: number | null; invert?: boolean; accent?: boolean; size?: "md" | "lg";
}) {
  return (
    <div className="card flex min-w-0 flex-col justify-between gap-3 p-5">
      <div className="text-[13px] font-normal text-muted">{label}</div>
      <div className={`numeral break-words ${size === "lg" ? "text-[clamp(30px,5vw,44px)]" : "text-[clamp(26px,4vw,34px)]"} ${accent ? "text-gold-light" : "text-ink"}`}>{value}</div>
      <div className="flex min-h-4 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        {delta !== undefined && <Delta value={delta} invert={invert} />}
        {sub}
      </div>
    </div>
  );
}
