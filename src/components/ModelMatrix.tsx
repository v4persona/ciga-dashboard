"use client";
import { fmtBRL, fmtNum, fmtX } from "@/lib/format";
import { signalLabels, type MatrixRow, type ModelMatrix as Matrix, type Signal } from "@/lib/metrics/matrix";
import { Th, useSort, type Accessors } from "./sortable";

type Key = "model" | "revenue" | "disponivel" | "spend" | "roas" | "utm" | "signals";
const accessors: Accessors<MatrixRow, Key> = {
  model: (r) => r.model,
  revenue: (r) => r.revenue,
  disponivel: (r) => r.disponivel,
  spend: (r) => r.spend,
  roas: (r) => (r.spend > 0 && r.claimedPurchases >= 1 ? r.roas : null),
  utm: (r) => (r.spend > 0 ? r.utmOrders : null),
  // sinais: vermelhos primeiro, depois quantidade; sem sinal vai para o fim
  signals: (r) => (r.signals.length ? -(r.signals.filter((s) => s === "repor" || s === "gasto_sem_venda").length * 10 + r.signals.length) : null),
};

const stockTone = { critico: "text-bad", atencao: "text-gold", ok: "text-ink" } as const;
const signalTone: Record<Signal, string> = {
  repor: "border-bad/40 bg-bad-dim text-bad",
  gasto_sem_venda: "border-bad/40 bg-bad-dim text-bad",
  sem_midia: "border-line-gold bg-gold-dim text-gold",
  atribuicao_inflada: "border-line-strong text-muted",
};
const signalOrder: Signal[] = ["repor", "gasto_sem_venda", "sem_midia", "atribuicao_inflada"];

/** barra fina de magnitude: dourado para receita; Meta azul + Google dourado para mídia */
function Bar({ parts, max }: { parts: { value: number; className: string }[]; max: number }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  if (!total || !max) return <div className="h-1 w-full rounded-[2px] bg-line" aria-hidden />;
  return (
    <div className="flex h-1 w-full gap-px rounded-[2px] bg-line" aria-hidden>
      {parts.filter((p) => p.value > 0).map((p, i) => (
        <div key={i} className={`h-1 rounded-[2px] ${p.className}`} style={{ width: `${(p.value / max) * 100}%` }} />
      ))}
    </div>
  );
}

function Signals({ signals }: { signals: Signal[] }) {
  if (!signals.length) return <span className="text-xs text-subtle">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {signalOrder.filter((s) => signals.includes(s)).map((s) => (
        <span key={s} title={signalLabels[s].decision} className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] leading-tight ${signalTone[s]}`}>
          {(s === "repor" || s === "gasto_sem_venda") && <span aria-hidden>⚠</span>}
          {signalLabels[s].label}
        </span>
      ))}
    </div>
  );
}

function Row({ r, maxRevenue, maxSpend, dim }: { r: MatrixRow; maxRevenue: number; maxSpend: number; dim: boolean }) {
  const claimed = Math.round(r.claimedPurchases);
  const utm = Math.round(r.utmOrders);
  return (
    <tr className={dim ? "opacity-40" : ""}>
      <td>
        <div className="flex items-center gap-3">
          {r.image ? <img src={r.image} alt="" className="thumb" loading="lazy" /> : <span className="thumb" />}
          <div className="min-w-32"><div className="font-normal text-ink">{r.model}</div><div className="text-xs text-subtle">{r.collection}</div></div>
        </div>
      </td>
      <td className="min-w-40">
        <div className="flex items-baseline justify-between gap-3"><span className="text-ink">{fmtBRL(r.revenue)}</span><span className="text-xs text-muted">{r.units} un.</span></div>
        <div className="mt-1.5"><Bar parts={[{ value: r.revenue, className: "bg-gold" }]} max={maxRevenue} /></div>
      </td>
      <td className="num whitespace-nowrap">
        <span className={`numeral text-xl ${stockTone[r.level]}`}>{r.disponivel}</span>
        <span className="ml-2 text-xs text-muted">{r.daysOfCover === null ? "—" : `${r.daysOfCover} d`}</span>
      </td>
      <td className="min-w-40">
        {r.spend > 0 ? (
          <>
            <div className="flex items-baseline justify-between gap-3"><span className="text-ink">{fmtBRL(r.spend)}</span><span className="text-xs text-muted">{r.campaigns.length} {r.campaigns.length === 1 ? "campanha" : "campanhas"}</span></div>
            <div className="mt-1.5"><Bar parts={[{ value: r.spendByPlatform.meta, className: "bg-blue" }, { value: r.spendByPlatform.google, className: "bg-gold" }]} max={maxSpend} /></div>
          </>
        ) : (
          <><div className="text-xs text-subtle">sem campanha própria</div><div className="mt-1.5"><Bar parts={[]} max={0} /></div></>
        )}
      </td>
      <td className={`num ${r.roas >= 3 ? "text-good" : r.roas > 0 && r.roas < 1.5 ? "text-bad" : "text-ink"}`}>{r.spend > 0 && claimed > 0 ? fmtX(r.roas) : "—"}</td>
      <td className="num whitespace-nowrap">
        {r.spend > 0 ? (
          <><span className="text-ink">{utm}</span><span className="text-xs text-muted"> {utm === 1 ? "pedido" : "pedidos"} · {claimed} {claimed === 1 ? "alegada" : "alegadas"}</span></>
        ) : <span className="text-subtle">—</span>}
      </td>
      <td><Signals signals={r.signals} /></td>
    </tr>
  );
}

export function ModelMatrix({ matrix, highlight }: { matrix: Matrix; highlight: string }) {
  const { sorted, sort, toggle } = useSort(matrix.rows, accessors, { key: "revenue", dir: "desc" });
  const maxRevenue = Math.max(...matrix.rows.map((r) => r.revenue), 0);
  const maxSpend = Math.max(...matrix.rows.map((r) => r.spend), 0);
  return (
    <>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Sinais de decisão">
        {signalOrder.map((s) => {
          const names = matrix.flagged[s];
          const n = names.length;
          const alert = (s === "repor" || s === "gasto_sem_venda") && n > 0;
          const shown = names.slice(0, 3).join(", ") + (n > 3 ? ` e mais ${n - 3}` : "");
          return (
            <li key={s} className={`card flex flex-col p-5 ${alert ? "border-bad/30" : ""}`}>
              <div className="text-xs text-muted">{signalLabels[s].label}</div>
              <div className={`numeral mt-2 text-[40px] ${alert ? "text-bad" : n > 0 && s === "sem_midia" ? "text-gold-light" : "text-ink"}`}>{n}</div>
              <div className="mt-1 min-h-8 text-sm text-ink">{n ? shown : <span className="text-subtle">nenhum modelo</span>}</div>
              <div className="mt-auto pt-3 text-xs text-subtle">{signalLabels[s].decision}</div>
            </li>
          );
        })}
      </ul>

      <div className="card mt-3 overflow-hidden">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5 pb-3">
          <h3 className="text-base font-normal text-ink">Por modelo</h3>
          <ul className="flex items-center gap-4 text-xs text-muted" aria-label="Legenda">
            <li className="flex items-center gap-2"><span aria-hidden className="inline-block h-1 w-4 rounded-[2px] bg-gold" />Receita</li>
            <li className="flex items-center gap-2"><span aria-hidden className="inline-block h-1 w-4 rounded-[2px] bg-blue" />Gasto Meta</li>
            <li className="flex items-center gap-2"><span aria-hidden className="inline-block h-1 w-4 rounded-[2px] bg-gold" />Gasto Google</li>
          </ul>
        </div>
        <div className="max-h-[720px] overflow-auto">
          <table className="table">
            <thead className="sticky top-0 bg-card">
              <tr>
                <Th label="Modelo" sortKey="model" sort={sort} onSort={toggle} />
                <Th label="Vendas no período" sortKey="revenue" sort={sort} onSort={toggle} num={false} />
                <Th label="Disponível · cobertura" sortKey="disponivel" sort={sort} onSort={toggle} num />
                <Th label="Mídia rateada" sortKey="spend" sort={sort} onSort={toggle} num={false} />
                <Th label="ROAS alegado" sortKey="roas" sort={sort} onSort={toggle} num />
                <Th label="Via UTM" sortKey="utm" sort={sort} onSort={toggle} num />
                <Th label="Sinal" sortKey="signals" sort={sort} onSort={toggle} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => <Row key={r.sku} r={r} maxRevenue={maxRevenue} maxSpend={maxSpend} dim={highlight !== "todos" && highlight !== r.sku} />)}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-5 py-3 text-xs text-subtle">
          Fora da matriz: {fmtBRL(matrix.genericSpend)} em {matrix.genericCampaigns.length} {matrix.genericCampaigns.length === 1 ? "campanha genérica" : "campanhas genéricas"}
          {matrix.genericCampaigns.length > 0 && <> ({matrix.genericCampaigns.join(", ")})</>} e {fmtNum(matrix.genericUtmOrders)} pedidos com UTM genérica ou não reconhecida.
          Mídia rateada = gasto das campanhas que citam o modelo no nome, dividido pelas unidades vendidas de cada modelo alvo.
        </p>
      </div>
    </>
  );
}
