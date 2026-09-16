import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { fmtBRL } from "@/lib/format";
import type { CartToRecover } from "@/lib/metrics/sales";

export function CartsTable({ carts, windowDays }: { carts: CartToRecover[]; windowDays: number }) {
  const total = carts.reduce((a, c) => a + c.value, 0);
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4">
        <h3 className="text-base font-normal text-ink">Carrinhos para recuperar</h3>
        <span className="text-xs text-muted">últimos {windowDays} dias · {carts.length} carrinhos · {fmtBRL(total)}</span>
      </div>
      <div className="max-h-[352px] overflow-auto">
        <table className="table">
          <thead className="sticky top-0 bg-card"><tr><th>Cliente</th><th>Produto</th><th>Abandonado há</th><th className="num">Valor</th><th /></tr></thead>
          <tbody>
            {carts.slice(0, 12).map((c) => (
              <tr key={c.id}>
                <td><div className="font-normal text-ink">{c.customer}</div><div className="text-xs text-subtle">{c.email}</div></td>
                <td className="text-muted">{c.items}</td>
                <td className="text-muted">{formatDistanceToNowStrict(parseISO(c.createdAt), { locale: ptBR })}</td>
                <td className="num text-ink">{fmtBRL(c.value)}</td>
                <td className="num"><a href={c.url} target="_blank" rel="noreferrer" className="text-xs text-gold hover:text-gold-light">Abrir checkout</a></td>
              </tr>
            ))}
            {!carts.length && <tr><td colSpan={5} className="py-10 text-center text-muted">Nenhum carrinho abandonado na janela.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
