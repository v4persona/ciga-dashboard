"use client";
import { levelLabels, type StockRow } from "@/lib/metrics/stock";
import { Th, useSort, type Accessors } from "./sortable";

type Key = "model" | "collection" | "saldo" | "reservado" | "disponivel" | "cover" | "level";
const levelRank = { critico: 0, atencao: 1, ok: 2 } as const;
const accessors: Accessors<StockRow, Key> = {
  model: (r) => r.model, collection: (r) => r.collection, saldo: (r) => r.saldo, reservado: (r) => r.reservado,
  disponivel: (r) => r.disponivel, cover: (r) => r.daysOfCover, level: (r) => levelRank[r.level],
};

const tone = { critico: "text-bad", atencao: "text-gold", ok: "text-muted" } as const;
const bar = { critico: "bg-bad", atencao: "bg-gold", ok: "bg-transparent" } as const;

export function StockTable({ rows, min, highlight }: { rows: StockRow[]; min: number; highlight: string }) {
  const { sorted, sort, toggle } = useSort(rows, accessors);
  return (
    <div className="card overflow-hidden">
      <div className="max-h-[560px] overflow-auto">
        <table className="table">
          <thead className="sticky top-0 bg-card">
            <tr>
              <th className="w-1 p-0" />
              <Th label="Modelo" sortKey="model" sort={sort} onSort={toggle} />
              <Th label="Coleção" sortKey="collection" sort={sort} onSort={toggle} />
              <Th label="Em estoque" sortKey="saldo" sort={sort} onSort={toggle} num />
              <Th label="Reservado" sortKey="reservado" sort={sort} onSort={toggle} num />
              <Th label="Disponível" sortKey="disponivel" sort={sort} onSort={toggle} num />
              <Th label="Cobertura" sortKey="cover" sort={sort} onSort={toggle} num />
              <Th label="Status" sortKey="level" sort={sort} onSort={toggle} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const dim = highlight !== "todos" && highlight !== r.sku;
              return (
                <tr key={r.sku} className={dim ? "opacity-40" : ""}>
                  <td className="w-1 p-0"><div className={`h-10 w-0.5 ${bar[r.level]}`} /></td>
                  <td>
                    <div className="flex items-center gap-3">
                      {r.image ? <img src={r.image} alt="" className="thumb" loading="lazy" /> : <span className="thumb" />}
                      <div className="min-w-32"><div className="font-normal text-ink">{r.model}</div><div className="hidden text-xs text-subtle sm:block">{r.sku}</div></div>
                    </div>
                  </td>
                  <td className="text-muted">{r.collection}</td>
                  <td className="num text-muted">{r.saldo}</td>
                  <td className="num text-muted">{r.reservado || "—"}</td>
                  <td className={`num numeral text-xl ${r.level === "ok" ? "text-ink" : tone[r.level]}`}>{r.disponivel}</td>
                  <td className="num text-muted">{r.daysOfCover === null ? "—" : `${r.daysOfCover} d`}</td>
                  <td>
                    <span className={`inline-flex items-center gap-1.5 text-xs ${tone[r.level]}`}>
                      {r.level === "critico" && <span aria-hidden>⚠</span>}
                      {r.level === "atencao" && <span aria-hidden>●</span>}
                      {r.level === "critico" ? `Abaixo de ${min}` : r.level === "atencao" ? `No mínimo (${min})` : levelLabels.ok}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
