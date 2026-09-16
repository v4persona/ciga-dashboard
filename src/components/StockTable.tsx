import { levelLabels, type StockRow } from "@/lib/metrics/stock";

const tone = { critico: "text-bad", atencao: "text-gold", ok: "text-muted" } as const;
const bar = { critico: "bg-bad", atencao: "bg-gold", ok: "bg-transparent" } as const;

export function StockTable({ rows, min, highlight }: { rows: StockRow[]; min: number; highlight: string }) {
  return (
    <div className="card overflow-hidden">
      <div className="max-h-[560px] overflow-auto">
        <table className="table">
          <thead className="sticky top-0 bg-card">
            <tr><th className="w-1 p-0" /><th>Modelo</th><th>Coleção</th><th className="num">Em estoque</th><th className="num">Reservado</th><th className="num">Disponível</th><th className="num">Cobertura</th><th>Status</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => {
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
