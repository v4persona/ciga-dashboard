import { fmtBRL } from "@/lib/format";
import type { ModelSales } from "@/lib/metrics/sales";

export function ModelBars({ rows, highlight }: { rows: ModelSales[]; highlight: string }) {
  const top = rows.slice(0, 8);
  const max = top[0]?.revenue ?? 1;
  if (!top.length) return <p className="py-10 text-center text-sm text-muted">Nenhuma venda no período.</p>;
  return (
    <ol className="flex flex-col gap-3">
      {top.map((r) => {
        const active = highlight === "todos" || highlight === r.sku;
        return (
          <li key={r.sku} className={`flex items-center gap-3 transition-opacity ${active ? "" : "opacity-40"}`}>
            {r.image ? <img src={r.image} alt="" className="thumb" loading="lazy" /> : <span className="thumb" />}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-normal text-ink">{r.model}</span>
                <span className="shrink-0 text-muted">{r.units} un. · <span className="text-ink">{fmtBRL(r.revenue)}</span></span>
              </div>
              <div className="mt-1.5 h-1.5 w-full rounded-[2px] bg-line">
                <div className="h-full rounded-[2px] bg-gold" style={{ width: `${Math.max(2, (r.revenue / max) * 100)}%` }} />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
