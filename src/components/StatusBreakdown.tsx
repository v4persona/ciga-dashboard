import { fmtBRL } from "@/lib/format";
import type { SalesSummary } from "@/lib/metrics/sales";

const colors: Record<string, string> = {
  finalizada: "var(--gold)",
  em_processo: "var(--gold-light)",
  aguardando_pagamento: "var(--blue)",
  cancelada: "var(--text-subtle)",
  reembolsada: "var(--rose)",
};

export function StatusBreakdown({ buckets }: { buckets: SalesSummary["buckets"] }) {
  const total = buckets.reduce((a, b) => a + b.count, 0);
  const visible = buckets.filter((b) => b.count > 0);
  if (!total) return <p className="py-10 text-center text-sm text-muted">Nenhum pedido no período.</p>;
  return (
    <div>
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-[2px]" role="img" aria-label="Distribuição dos pedidos por status">
        {visible.map((b) => (
          <div key={b.key} style={{ width: `${(b.count / total) * 100}%`, background: colors[b.key] }} title={`${b.label}: ${b.count}`} />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {buckets.map((b) => (
          <li key={b.key} className="flex items-center justify-between gap-3 border-b border-line py-1.5 last:border-0 sm:[&:nth-last-child(2)]:border-0">
            <span className="flex items-center gap-2 text-muted">
              <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: colors[b.key] }} />
              {b.label}
            </span>
            <span className="text-ink">{b.count} <span className="text-subtle">· {fmtBRL(b.value)}</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}
