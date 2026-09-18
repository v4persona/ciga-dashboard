import { fmtNum, fmtPct } from "@/lib/format";
import type { Funnel } from "@/lib/metrics/operations";

/**
 * Funil da loja em três degraus. Cada degrau é um valor com barra de magnitude (série única, dourado)
 * e rótulo direto; entre eles, a taxa de passagem. Sem cor como única informação.
 */
export function FunnelSteps({ funnel }: { funnel: Funnel }) {
  const max = Math.max(...funnel.steps.map((s) => s.value), 1);
  const rates = [funnel.checkoutRate, funnel.closeRate];
  return (
    <ol className="flex flex-col gap-1">
      {funnel.steps.map((s, i) => (
        <li key={s.key}>
          <div className="card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-[13px] text-muted">{s.label}</span>
              <span className="text-xs text-subtle">{s.note}</span>
            </div>
            <div className="mt-2 flex items-center gap-4">
              <span className={`numeral text-[clamp(24px,4vw,32px)] ${i === 0 ? "text-ink" : "text-gold-light"}`}>{fmtNum(s.value)}</span>
              <div className="h-1.5 flex-1 rounded-[2px] bg-line">
                <div className="h-1.5 rounded-[2px] bg-gold" style={{ width: `${Math.max(2, (s.value / max) * 100)}%` }} aria-hidden />
              </div>
            </div>
          </div>
          {i < rates.length && (
            <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-muted">
              <span aria-hidden className="text-subtle">↓</span>
              {rates[i] === null ? "sem base" : <>{fmtPct(rates[i]!, 2)} seguem para o próximo passo</>}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
