"use client";
import { fmtBRL, fmtNum } from "@/lib/format";
import type { RepositionRow } from "@/lib/metrics/operations";
import { levelLabels } from "@/lib/metrics/stock";
import { Th, useSort, type Accessors } from "./sortable";

type Key = "model" | "units" | "disponivel" | "cover" | "risk";
const accessors: Accessors<RepositionRow, Key> = {
  model: (r) => r.model,
  units: (r) => r.units,
  disponivel: (r) => r.disponivel,
  cover: (r) => r.daysOfCover,
  risk: (r) => r.valueAtRisk,
};

const tone = { critico: "text-bad", atencao: "text-gold", ok: "text-ink" } as const;
const bar = { critico: "bg-bad", atencao: "bg-gold", ok: "bg-transparent" } as const;

/** o que fazer com a linha, em uma frase */
function advice(r: RepositionRow) {
  if (r.units > 0 && r.disponivel <= 0) return "Repor: vendendo e sem peça";
  if (r.units > 0 && r.level !== "ok") return `Repor: acaba em ~${r.daysOfCover} d`;
  if (r.units > 0 && (r.daysOfCover ?? 999) <= 30) return `Programar: ${r.daysOfCover} d de cobertura`;
  if (r.units === 0 && r.level === "critico") return "Sem venda e sem peça: decidir se sai da loja";
  return "—";
}

export function RepositionTable({ rows, limit = 20 }: { rows: RepositionRow[]; limit?: number }) {
  const { sorted, sort, toggle } = useSort(rows.slice(0, limit), accessors);
  const maxRisk = Math.max(...rows.map((r) => r.valueAtRisk), 1);
  return (
    <div className="card overflow-hidden">
      <div className="max-h-[560px] overflow-auto">
        <table className="table">
          <thead className="sticky top-0 bg-card">
            <tr>
              <th className="w-1 p-0" />
              <Th label="Modelo" sortKey="model" sort={sort} onSort={toggle} />
              <Th label={`Vendas 30 d`} sortKey="units" sort={sort} onSort={toggle} num />
              <Th label="Disponível" sortKey="disponivel" sort={sort} onSort={toggle} num />
              <Th label="Cobertura" sortKey="cover" sort={sort} onSort={toggle} num />
              <Th label="Receita em risco" sortKey="risk" sort={sort} onSort={toggle} num />
              <th>Ação sugerida</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.sku}>
                <td className="w-1 p-0"><div className={`h-10 w-0.5 ${bar[r.level]}`} /></td>
                <td>
                  <div className="flex items-center gap-3">
                    {r.image ? <img src={r.image} alt="" className="thumb" loading="lazy" /> : <span className="thumb" />}
                    <div className="min-w-32">
                      <div className="font-normal text-ink">{r.model}</div>
                      <div className="hidden text-xs text-subtle sm:block">{r.collection}</div>
                    </div>
                  </div>
                </td>
                <td className="num text-muted">{r.units || "—"}</td>
                <td className={`num numeral text-xl ${tone[r.level]}`}>
                  {r.disponivel}
                  {r.reservado > 0 && <div className="text-xs font-normal text-subtle">{r.reservado} reservada{r.reservado > 1 ? "s" : ""}</div>}
                </td>
                <td className="num text-muted">{r.daysOfCover === null ? "—" : `${r.daysOfCover} d`}</td>
                <td className="num min-w-32">
                  {r.valueAtRisk > 0 ? (
                    <>
                      <span className="text-ink">{fmtBRL(r.valueAtRisk)}</span>
                      <div className="mt-1.5 h-1 w-full rounded-[2px] bg-line">
                        <div className="h-1 rounded-[2px] bg-gold" style={{ width: `${(r.valueAtRisk / maxRisk) * 100}%` }} aria-hidden />
                      </div>
                    </>
                  ) : (
                    <span className="text-subtle">—</span>
                  )}
                </td>
                <td className="text-xs text-muted">{advice(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-line px-4 py-2 text-xs text-subtle">
        <span>{fmtNum(Math.min(limit, rows.length))} de {fmtNum(rows.length)} SKUs · ordenado por urgência</span>
        <span>{levelLabels.critico} = abaixo do mínimo</span>
      </div>
    </div>
  );
}
